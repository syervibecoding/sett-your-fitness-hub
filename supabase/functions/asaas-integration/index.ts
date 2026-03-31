import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function asaasFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Asaas API error:", JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || "Erro na API do Asaas");
  }
  return data;
}

async function createCustomer(body: any) {
  const { studentId, name, email, cpfCnpj, mobilePhone, postalCode, address, addressNumber, province, cityName, state } = body;
  if (!studentId || !name || !cpfCnpj) {
    throw new Error("studentId, name e cpfCnpj são obrigatórios");
  }

  // Check if student already has asaas_customer_id
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("asaas_customer_id")
    .eq("id", studentId)
    .single();

  if (student?.asaas_customer_id) {
    return { customerId: student.asaas_customer_id };
  }

  const customerPayload: any = {
    name,
    email: email || undefined,
    cpfCnpj: cpfCnpj.replace(/\D/g, ""),
    mobilePhone: mobilePhone?.replace(/\D/g, "") || undefined,
    externalReference: studentId,
  };

  if (postalCode) customerPayload.postalCode = postalCode.replace(/\D/g, "");
  if (address) customerPayload.address = address;
  if (addressNumber) customerPayload.addressNumber = addressNumber;
  if (province) customerPayload.province = province;

  const customer = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify(customerPayload),
  });

  // Save asaas_customer_id on student
  await supabaseAdmin
    .from("students")
    .update({ asaas_customer_id: customer.id })
    .eq("id", studentId);

  return { customerId: customer.id };
}

async function updateCustomer(body: any) {
  const { studentId, name, email, mobilePhone, postalCode, address, addressNumber, province } = body;
  if (!studentId) throw new Error("studentId é obrigatório");

  const { data: student } = await supabaseAdmin
    .from("students")
    .select("asaas_customer_id")
    .eq("id", studentId)
    .single();

  if (!student?.asaas_customer_id) {
    throw new Error("Cliente Asaas não encontrado para este aluno.");
  }

  const payload: any = {};
  if (name) payload.name = name;
  if (email) payload.email = email;
  if (mobilePhone) payload.mobilePhone = mobilePhone.replace(/\D/g, "");
  if (postalCode) payload.postalCode = postalCode.replace(/\D/g, "");
  if (address) payload.address = address;
  if (addressNumber) payload.addressNumber = addressNumber;
  if (province) payload.province = province;

  const customer = await asaasFetch(`/customers/${student.asaas_customer_id}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { customerId: customer.id, updated: true };
}


async function createPayment(body: any) {
  const { studentId, billingType, value, dueDate, description, planId } = body;
  if (!studentId || !billingType || !value) {
    throw new Error("studentId, billingType e value são obrigatórios");
  }

  // Get customer id
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("asaas_customer_id, company_id")
    .eq("id", studentId)
    .single();

  if (!student?.asaas_customer_id) {
    throw new Error("Cliente Asaas não encontrado. Crie o cliente primeiro.");
  }

  const payment = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: student.asaas_customer_id,
      billingType,
      value: Number(value),
      dueDate: dueDate || new Date().toISOString().split("T")[0],
      description: description || "Plano BN Performance Training",
      externalReference: studentId,
    }),
  });

  // Save to payments table
  await supabaseAdmin.from("payments").insert({
    student_id: studentId,
    company_id: student.company_id || null,
    asaas_customer_id: student.asaas_customer_id,
    asaas_payment_id: payment.id,
    billing_type: billingType,
    value: Number(value),
    status: payment.status || "PENDING",
    due_date: payment.dueDate || null,
    invoice_url: payment.invoiceUrl || null,
    installment_count: 1,
  });

  // Ativar aluno automaticamente se pagamento já confirmado
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status)) {
    await applyPaymentStatusEffects(studentId, payment.status, payment.id, planId);
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    invoiceUrl: payment.invoiceUrl,
  };
}

async function getPixQrCode(body: any) {
  const { paymentId } = body;
  if (!paymentId) throw new Error("paymentId é obrigatório");

  const data = await asaasFetch(`/payments/${paymentId}/pixQrCode`);
  return {
    encodedImage: data.encodedImage,
    payload: data.payload,
    expirationDate: data.expirationDate,
  };
}

async function createCardPayment(body: any) {
  const {
    studentId,
    value,
    dueDate,
    description,
    creditCard,
    creditCardHolderInfo,
    remoteIp,
    installmentCount,
    installmentValue,
  } = body;

  if (!studentId || !value || !creditCard || !creditCardHolderInfo) {
    throw new Error("Dados incompletos para pagamento com cartão");
  }

  const { data: student } = await supabaseAdmin
    .from("students")
    .select("asaas_customer_id, company_id")
    .eq("id", studentId)
    .single();

  if (!student?.asaas_customer_id) {
    throw new Error("Cliente Asaas não encontrado.");
  }

  const paymentPayload: any = {
    customer: student.asaas_customer_id,
    billingType: "CREDIT_CARD",
    value: Number(value),
    dueDate: dueDate || new Date().toISOString().split("T")[0],
    description: description || "Plano BN Performance Training",
    externalReference: studentId,
    creditCard: {
      holderName: creditCard.holderName,
      number: creditCard.number.replace(/\D/g, ""),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: creditCardHolderInfo.name,
      email: creditCardHolderInfo.email,
      cpfCnpj: creditCardHolderInfo.cpfCnpj?.replace(/\D/g, ""),
      postalCode: creditCardHolderInfo.postalCode?.replace(/\D/g, ""),
      addressNumber: creditCardHolderInfo.addressNumber || "0",
      phone: creditCardHolderInfo.phone?.replace(/\D/g, "") || undefined,
    },
    remoteIp: remoteIp || "0.0.0.0",
  };

  if (installmentCount && installmentCount > 1) {
    paymentPayload.installmentCount = installmentCount;
    paymentPayload.installmentValue = installmentValue || Number((Number(value) / installmentCount).toFixed(2));
  }

  const payment = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify(paymentPayload),
  });

  await supabaseAdmin.from("payments").insert({
    student_id: studentId,
    company_id: student.company_id || null,
    asaas_customer_id: student.asaas_customer_id,
    asaas_payment_id: payment.id,
    billing_type: "CREDIT_CARD",
    value: Number(value),
    status: payment.status || "PENDING",
    due_date: payment.dueDate || null,
    invoice_url: payment.invoiceUrl || null,
    installment_count: installmentCount && installmentCount > 1 ? installmentCount : 1,
  });

  // Ativar aluno automaticamente se pagamento já confirmado
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status)) {
    await applyPaymentStatusEffects(studentId, payment.status, payment.id);
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    invoiceUrl: payment.invoiceUrl,
  };
}

async function createInvoice(body: any) {
  const { paymentId } = body;
  if (!paymentId) throw new Error("paymentId é obrigatório");

  const { data: localPayment } = await supabaseAdmin
    .from("payments")
    .select("student_id")
    .eq("asaas_payment_id", paymentId)
    .single();

  if (localPayment?.student_id) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, asaas_customer_id, full_name, email, phone, whatsapp, cpf, cep, address, address_number, neighborhood")
      .eq("id", localPayment.student_id)
      .single();

    if (student?.asaas_customer_id) {
      const normalizedCep = (student.cep || "").replace(/\D/g, "");
      const normalizedPhone = (student.whatsapp || student.phone || "").replace(/\D/g, "");

      if (!student.address || !student.address_number || !student.neighborhood || normalizedCep.length !== 8) {
        throw new Error(
          "Dados de endereço incompletos para emissão de nota. Preencha Rua, Número, Bairro e CEP válido (8 dígitos)."
        );
      }

      await updateCustomer({
        studentId: student.id,
        name: student.full_name,
        email: student.email || undefined,
        mobilePhone: normalizedPhone || undefined,
        postalCode: normalizedCep,
        address: student.address,
        addressNumber: student.address_number,
        province: student.neighborhood,
      });
    }
  }

  const invoice = await asaasFetch("/invoices", {
    method: "POST",
    body: JSON.stringify({
      payment: paymentId,
      serviceDescription: "Consultoria em educação física",
      observations: "Nota fiscal referente ao plano BN Performance Training",
      effectiveDate: new Date().toISOString().split("T")[0],
      municipalServiceId: "8446",
      municipalServiceCode: "8599-6/04",
      municipalServiceName: "8.02 - TREINAMENTO EM DESENVOLVIMENTO PROFISSIONAL E GERENCIAL",
      taxes: {
        retainIss: false,
        iss: 0,
        cofins: 0,
        csll: 0,
        inss: 0,
        ir: 0,
        pis: 0,
      },
    }),
  });

  // Save invoice status on the payment record
  await supabaseAdmin
    .from("payments")
    .update({ invoice_status: invoice.status || "SCHEDULED" })
    .eq("asaas_payment_id", paymentId);

  return {
    invoiceId: invoice.id,
    status: invoice.status,
  };
}

async function ensureEnrollmentExists(studentId: string) {
  const { data: existing } = await supabaseAdmin
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return existing.id;

  const { data: student } = await supabaseAdmin
    .from("students")
    .select("selected_plan_id, assigned_trainer_id, company_id")
    .eq("id", studentId)
    .single();

  if (!student?.selected_plan_id) {
    console.error(`Student ${studentId} has no selected_plan_id`);
    return null;
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("duration_weeks, company_id")
    .eq("id", student.selected_plan_id)
    .single();

  if (!plan) return null;

  // Resolve company_id: student → plan fallback
  const companyId = student.company_id || plan.company_id || null;

  // Resolve created_by: use company owner instead of student UUID
  let createdBy = studentId;
  if (companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("owner_user_id")
      .eq("id", companyId)
      .single();
    if (company?.owner_user_id) {
      createdBy = company.owner_user_id;
    }
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + plan.duration_weeks * 7);

  const { data: enrollment, error } = await supabaseAdmin
    .from("enrollments")
    .insert({
      student_id: studentId,
      plan_id: student.selected_plan_id,
      trainer_id: student.assigned_trainer_id || null,
      created_by: createdBy,
      start_date: today.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      payment_status: "paid",
      payment_date: today.toISOString().split("T")[0],
      status: "active",
      company_id: companyId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error auto-creating enrollment:", error);
    return null;
  }

  console.log(`Auto-created enrollment ${enrollment.id} for student ${studentId} (company: ${companyId})`);
  return enrollment.id;
}

async function applyPaymentStatusEffects(studentId: string, paymentStatus: string, asaasPaymentId?: string) {
  console.log(`[FALLBACK] Aplicando status ${paymentStatus} para aluno ${studentId}`);

  if (
    paymentStatus === "RECEIVED" ||
    paymentStatus === "CONFIRMED" ||
    paymentStatus === "RECEIVED_IN_CASH"
  ) {
    const { error: studentError } = await supabaseAdmin
      .from("students")
      .update({ status: "active" })
      .eq("id", studentId);

    if (studentError) {
      console.error("Erro ao ativar aluno no fallback:", studentError);
    }

    // Ensure enrollment exists (auto-create if missing)
    await ensureEnrollmentExists(studentId);

    const { error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .update({
        payment_status: "paid",
        payment_date: new Date().toISOString().split("T")[0],
      })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (enrollmentError) {
      console.error("Erro ao atualizar matrícula no fallback:", enrollmentError);
    }

    if (asaasPaymentId) {
      try {
        await createInvoice({ paymentId: asaasPaymentId });
      } catch (error) {
        console.error("Erro ao emitir NFS-e no fallback de status:", error);
      }
    }

    return;
  }

  if (paymentStatus === "OVERDUE") {
    const { error } = await supabaseAdmin
      .from("enrollments")
      .update({ payment_status: "overdue" })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (error) {
      console.error("Erro ao marcar matrícula como overdue no fallback:", error);
    }

    return;
  }

  if (
    paymentStatus === "REFUNDED" ||
    paymentStatus === "DELETED" ||
    paymentStatus === "REFUND_REQUESTED"
  ) {
    const { error: studentError } = await supabaseAdmin
      .from("students")
      .update({ status: "pending" })
      .eq("id", studentId);

    if (studentError) {
      console.error("Erro ao desativar aluno no fallback:", studentError);
    }

    const { error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .update({ payment_status: "refunded" })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (enrollmentError) {
      console.error("Erro ao atualizar matrícula para refunded no fallback:", enrollmentError);
    }
  }
}

async function getPaymentStatus(body: any) {
  const { paymentId } = body;
  if (!paymentId) throw new Error("paymentId é obrigatório");

  const payment = await asaasFetch(`/payments/${paymentId}`);

  // Update local payment status + installment count if available
  const updateData: any = { status: payment.status };
  if (payment.installmentCount && payment.installmentCount > 1) {
    updateData.installment_count = payment.installmentCount;
  }
  const { data: localPayment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .update(updateData)
    .eq("asaas_payment_id", paymentId)
    .select("student_id")
    .single();

  if (paymentError) {
    console.error("Erro ao atualizar pagamento no fallback:", paymentError);
  } else if (localPayment?.student_id) {
    await applyPaymentStatusEffects(localPayment.student_id, payment.status, paymentId);
  }

  return {
    status: payment.status,
    value: payment.value,
    billingType: payment.billingType,
    invoiceUrl: payment.invoiceUrl,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...body } = await req.json();

    let result;
    switch (action) {
      case "create-customer":
        result = await createCustomer(body);
        break;
      case "create-payment":
        result = await createPayment(body);
        break;
      case "get-pix-qrcode":
        result = await getPixQrCode(body);
        break;
      case "create-card-payment":
        result = await createCardPayment(body);
        break;
      case "get-payment-status":
        result = await getPaymentStatus(body);
        break;
      case "create-invoice":
        result = await createInvoice(body);
        break;
      case "update-customer":
        result = await updateCustomer(body);
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
