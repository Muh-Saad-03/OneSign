import fs from 'fs';
import path from 'path';
import OpenAI from "openai";
import { conversationRepository } from "../repositories/conversation.respository";
import template from '../prompts/chatbot.txt'

const client = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY
});



type ChatResponse = {
    id: string;
    message: string;
}

export const chatService = {
    async sendMessage(prompt: string, conversationID: string): Promise<ChatResponse>{
        const response = await client.responses.create({
           model: 'gpt-4o-mini',
           instructions: template,
           input: prompt, 
           temperature: 0.5,
           max_output_tokens: 100,
           previous_response_id: conversationRepository.getLastResponseID(conversationID),
        });
        
        conversationRepository.setLastResponseID(conversationID, response.id);
        return  {
            id: response.id,
            message: response.output_text
        };
    }
}