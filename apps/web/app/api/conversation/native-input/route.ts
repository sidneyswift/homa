import { after } from "next/server";

import { conversationNativeResponse } from "../../../../lib/conversation-native-route";
import { kickConversationRequests,kickConversationRecording } from "../../../../lib/conversation-request-kick";

export async function GET(request:Request){return conversationNativeResponse(request);}
export async function POST(request:Request){
  const response=await conversationNativeResponse(request);
  if(response.ok)after(async()=>{await kickConversationRequests();await kickConversationRecording();});
  return response;
}
