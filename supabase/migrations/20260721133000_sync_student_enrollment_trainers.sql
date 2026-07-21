-- Keep the trainer shown on the student profile and the active enrollment in sync.
-- This prevents "Aguardando treinador" when only one side of the relationship was filled.

create or replace function public.fill_enrollment_trainer_from_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_trainer uuid;
begin
  if new.trainer_id is null then
    select assigned_trainer_id
      into v_assigned_trainer
      from public.students
     where id = new.student_id;

    if v_assigned_trainer is not null then
      new.trainer_id := v_assigned_trainer;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_enrollment_trainer_from_student on public.enrollments;
create trigger trg_fill_enrollment_trainer_from_student
before insert or update of student_id, trainer_id on public.enrollments
for each row
execute function public.fill_enrollment_trainer_from_student();

create or replace function public.fill_student_trainer_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trainer_id is not null then
    update public.students
       set assigned_trainer_id = new.trainer_id,
           updated_at = now()
     where id = new.student_id
       and assigned_trainer_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_student_trainer_from_enrollment on public.enrollments;
create trigger trg_fill_student_trainer_from_enrollment
after insert or update of trainer_id on public.enrollments
for each row
execute function public.fill_student_trainer_from_enrollment();

create or replace function public.sync_active_enrollments_from_student_trainer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_trainer_id is not null
     and coalesce(old.assigned_trainer_id::text, '') is distinct from coalesce(new.assigned_trainer_id::text, '') then
    update public.enrollments
       set trainer_id = new.assigned_trainer_id,
           updated_at = now()
     where student_id = new.id
       and status in ('active', 'awaiting_training', 'awaiting_renewal');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_active_enrollments_from_student_trainer on public.students;
create trigger trg_sync_active_enrollments_from_student_trainer
after update of assigned_trainer_id on public.students
for each row
execute function public.sync_active_enrollments_from_student_trainer();
