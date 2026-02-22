-- Add HXT client reference number to proposals
ALTER TABLE public.proposals
  ADD COLUMN hxt_reference TEXT;

CREATE INDEX idx_proposals_hxt_reference ON public.proposals(hxt_reference);
