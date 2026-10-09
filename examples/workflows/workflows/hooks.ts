import { defineHook } from 'workflow';
import { approvalSchema } from '../lib/contracts';

// Native, schema-validated hook. Authenticate the inbound route BEFORE resume.
export const approvalHook = defineHook({ schema: approvalSchema });
