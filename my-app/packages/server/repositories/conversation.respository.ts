const conversations = new Map<string, string>();

export const conversationRepository = {
    getLastResponseID(conversationID: string){
    return conversations.get(conversationID);
}, 

setLastResponseID(conversationID: string, responseID: string){
    conversations.set(conversationID, responseID);
},
};

