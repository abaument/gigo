-- Representative "dirty" input stored per adapter: pre-fills the playground
-- so trying an adapter never requires hand-writing a payload.
ALTER TABLE "adapters" ADD COLUMN "sample_payload" TEXT;
