
import React, { useState } from 'react';
import ChatBot from './components/chat/ChatBot';
import OneSign from './components/OneSign';



const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M4.912 18.062 7.159 16.32a.75.75 0 0 1 .84-1.28l4.897 3.265c.348.232.82.028 1.053-.32a11.107 11.107 0 0 0 4.197-7.859c0-6.19-5.163-11.25-11.536-11.25S1.912 6.551 1.912 12.74c0 1.956.555 3.824 1.585 5.426.376.6.615.65.658.65l.757-.043 1.053.869Zm13.886-4.227a8.25 8.25 0 1 0-16.5 0 8.25 8.25 0 0 0 16.5 0ZM12 10.5a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H12Zm-.008 3a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H12Z" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);


function App() {
   const [isOpen, setIsOpen] = useState(false);
   const toggleChat = () => {
      setIsOpen(!isOpen);
   };

   return (

      <div className="relative min-h-screen w-full bg-slate-950 text-white bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(79,70,229,.12),transparent),radial-gradient(900px_400px_at_110%_10%,rgba(30,41,59,.5),transparent)]"> 
         
         {/* Main Page Content*/}
         <div className="py-10">
            <OneSign />
         </div>

         {/* 1. */}
         {isOpen && (
            <div className="fixed bottom-24 right-6 w-full max-w-sm h-[500px] 
                            bg-slate-800/80 backdrop-blur-lg shadow-2xl 
                            rounded-xl overflow-hidden z-50 transition-all duration-300 
                            border border-indigo-700/50">
               
               {/* Gradient Header */}
               <div className="flex justify-between items-center p-4 
                               bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="text-xl">☰</span> 
                      AI Assistant
                  </h3>
                  {/* Close Button */}
                  <button 
                      onClick={toggleChat} 
                      className="p-1 rounded-full hover:bg-white/10 transition"
                  >
                     <CloseIcon />
                  </button>
               </div>
               
               {/* The actual ChatBot content area */}
               <div className="h-[calc(100%-60px)] p-2"> 
                   <ChatBot /> 
               </div>
            </div>
         )}

         {/* 2*/}
         <button
            onClick={toggleChat}
            className={`fixed bottom-6 right-6 h-14 w-14 rounded-full 
                        shadow-2xl z-50 
                        transition-all duration-300 ease-in-out 
                        flex items-center justify-center 
                        ${isOpen 
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
            title={isOpen ? "Close Chat" : "Open Chat"}
         >
            <span className="text-white">
                {isOpen ? <CloseIcon /> : <ChatIcon />}
            </span>
         </button>
      </div>
   );
}

export default App;