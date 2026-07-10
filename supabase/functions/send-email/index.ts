import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: to, subject e html ou text.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E-mail não configurado. Conecte o Resend para habilitar o envio por e-mail.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Set Training <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`send-email failed [${response.status}]: ${errorBody}`);
      return new Response(
        JSON.stringify({ error: 'Falha no envio de e-mail', status: response.status, details: errorBody }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('send-email error:', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
