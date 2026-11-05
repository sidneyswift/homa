import { requestAuthTransport } from "./api-auth";
import { resolveConversationRequestPrincipal } from "./conversation-request-auth";
import { acceptNativeConversationAnswer, readNativeConversationBatchPage } from "./conversation-native-batches";
import { BodyError,inputBody } from "./conversation-request-route";
import { ConversationRequestError } from "./conversation-requests";
import { rateLimited } from "./map/ratelimit";

export interface NativeRouteDependencies {
  enabled():boolean;
  principal:typeof resolveConversationRequestPrincipal;
  read:typeof readNativeConversationBatchPage;
  accept:typeof acceptNativeConversationAnswer;
  limited(account:string):boolean;
}
const dependencies:NativeRouteDependencies={
  enabled:()=>process.env.HOMA_CONVERSATION_REQUESTS==='1' && process.env.HOMA_CONVERSATION_RECORDING==='1' && process.env.HOMA_CONVERSATION_NATIVE_INPUT==='1',
  principal:resolveConversationRequestPrincipal,read:readNativeConversationBatchPage,accept:acceptNativeConversationAnswer,
  limited:account=>rateLimited(`conversation-native:${account}`,120),
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
const response=(body:object,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','vary':'Authorization'}});
export async function conversationNativeResponse(request:Request, deps:NativeRouteDependencies=dependencies) {
  if(!deps.enabled())return response({reason:'unavailable'},503);
  if(!['GET','POST'].includes(request.method))return response({reason:'method'},405);
  if(requestAuthTransport(request).kind!=='bearer')return response({reason:'sign_in'},401);
  try{
    const principal=await deps.principal(request);
    if(!principal)return response({reason:'sign_in'},401);
    const account=`${principal.familyId}:${principal.memberUserId}`;
    if(deps.limited(account))return response({reason:'retry'},429);
    const body=request.method==='GET'?Object.fromEntries(new URL(request.url).searchParams):await inputBody(request);
    if(body.account!==account)return response({reason:'account_changed'},409);
    if(typeof body.accessEpoch!=='string'||!uuid.test(body.accessEpoch))return response({reason:'invalid'},400);
    const owner={...principal,accessEpoch:body.accessEpoch};
    if(request.method==='GET') {
      if(Object.keys(body).some(key=>!['account','accessEpoch','cursor'].includes(key)))return response({reason:'invalid'},400);
      if(body.cursor!==undefined&&typeof body.cursor!=="string")return response({reason:"invalid"},400);
      return response(await deps.read(owner,body.cursor as string|undefined));
    }
    if(Object.keys(body).some(key=>!['account','accessEpoch','intentId','batchId','responses'].includes(key))||
      typeof body.intentId!=='string'||!uuid.test(body.intentId)||typeof body.batchId!=='string'||!uuid.test(body.batchId)||
      !Array.isArray(body.responses))return response({reason:'invalid'},400);
    const receipt=await deps.accept(owner,{intentId:body.intentId,batchId:body.batchId,responses:body.responses});
    return response({receipt},receipt.replayed?200:202);
  }catch(error){
    if(error instanceof BodyError)return response({reason:error.reason},error.status);
    if(error instanceof ConversationRequestError && error.code==='missing')return response({reason:'deleted'},410);
    if(error instanceof ConversationRequestError)return response({reason:error.code},error.code==='invalid'?400:error.code==='membership'?403:error.code==='deleted'?410:error.code==='missing'?404:409);
    return response({reason:'retry'},503);
  }
}
