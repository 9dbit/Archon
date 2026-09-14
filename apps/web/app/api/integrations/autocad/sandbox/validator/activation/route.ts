import {createValidatorActivationPlan} from '../../../../../../../../../packages/autocad-plugin/validator-activation-plan.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 return Response.json(createValidatorActivationPlan(),{headers:{'Cache-Control':'no-store'}});
}
