-- Family stub folds update related family ids inside one transaction. Defer
-- exact-offer composite keys until commit so those coordinated moves remain
-- valid regardless of table update order.

alter table public.conversation_offer_fulfillments
  alter constraint conversation_offer_fulfillments_delivery_family_fkey
  deferrable initially deferred;

alter table public.conversation_thread_bindings
  alter constraint
    conversation_thread_bindings_pending_offer_delivery_fkey
  deferrable initially deferred;

alter table public.materials
  alter constraint materials_source_offer_delivery_fkey
  deferrable initially deferred;

alter table public.agent_schedules
  alter constraint agent_schedules_source_offer_delivery_fkey
  deferrable initially deferred;
