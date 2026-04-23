import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Send, 
  Stethoscope, 
  User, 
  Bot, 
  Sidebar, 
  X,
  Menu,
  ChevronLeft,
  Loader2,
  Mic,
  MicOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, Chat, Message } from './lib/utils';
import { sendChatMessage } from './services/api';

// Types for Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU'; // Set to Russian

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(prev => {
          // Prevent duplicating transcript if it's already updated
          return transcript;
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Ваш браузер не поддерживает голосовой ввод.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  // Persistence
  useEffect(() => {
    const savedChats = localStorage.getItem('medichat_history');
    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChats(parsed);
      if (parsed.length > 0) setActiveChatId(parsed[0].id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('medichat_history', JSON.stringify(chats));
  }, [chats]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'Новая консультация',
      messages: [],
      createdAt: Date.now(),
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chats.filter(c => c.id !== id);
    setChats(updated);
    if (activeChatId === id) {
      setActiveChatId(updated[0]?.id || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const updatedChatMessages = [...(activeChat?.messages || []), userMessage];
    
    // Update local state immediately
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: updatedChatMessages, title: c.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : c.title } 
        : c
    ));
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(updatedChatMessages);
      const assistantMessage: Message = { role: 'assistant', content: response.content };
      
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { ...c, messages: [...updatedChatMessages, assistantMessage] } 
          : c
      ));
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: `**Ошибка:** ${error.message}. Пожалуйста, убедитесь, что API ключ OpenAI настроен.` 
      };
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { ...c, messages: [...updatedChatMessages, errorMessage] } 
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 medical-gradient">
      {/* Mobile Backdrop */}
      {!isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-white/10 z-40 backdrop-blur-md" onClick={() => setIsSidebarOpen(true)} />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "glass border-r-0 m-4 rounded-3xl flex flex-col h-[calc(100%-2rem)] z-50 overflow-hidden shrink-0",
          !isSidebarOpen && "lg:w-0 lg:m-0"
        )}
      >
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary-700 font-bold text-xl tracking-tight">
              <div className="w-10 h-10 bg-primary-600/90 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20 backdrop-blur-sm">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">HealthAI</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-white/40 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary-600" />
            </button>
          </div>

          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-primary-600/25 active:scale-[0.98] hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            Новая консультация
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black px-3 mb-4 opacity-70">История</div>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={cn(
                "w-full group text-left px-4 py-4 rounded-2xl flex flex-col transition-all border outline-none",
                activeChatId === chat.id 
                  ? "bg-white/60 border-white/60 shadow-md text-slate-900" 
                  : "bg-transparent border-transparent text-slate-500 hover:bg-white/30 hover:border-white/40"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="truncate text-sm font-bold tracking-tight">{chat.title}</span>
                <Trash2 
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="w-4 h-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" 
                />
              </div>
              <p className="text-[11px] text-slate-400 truncate w-full font-medium opacity-80">
                {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.slice(0, 35) + '...' : 'Ожидание вопроса...'}
              </p>
            </button>
          ))}
          {chats.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm italic font-medium opacity-60">История пуста</p>
            </div>
          )}
        </nav>

        <div className="p-6">
          <div className="flex items-center gap-3 p-4 bg-white/30 rounded-2xl border border-white/40">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-black shadow-inner">
              AI
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-900 tracking-tight">GPT-4o mini</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Ready to help</p>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full p-4 pl-0 lg:pl-0">
        <div className="flex-1 glass rounded-3xl flex flex-col overflow-hidden relative">
          {/* Header */}
          <header className="h-20 bg-white/20 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-8 shrink-0 z-10">
            <div className="flex items-center gap-4 min-w-0">
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2.5 hover:bg-white/40 rounded-xl text-primary-600 transition-colors shadow-sm"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <div className="flex flex-col min-w-0">
                <h1 className="font-black text-slate-900 truncate tracking-tight text-lg leading-tight uppercase mr-2">
                  {activeChat ? activeChat.title : "Консультация"}
                </h1>
                {activeChat && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Сессия активна</span>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar scroll-smooth">
            <div className="max-w-3xl mx-auto space-y-10">
              {activeChat ? (
                <>
                  <AnimatePresence initial={false}>
                    {activeChat.messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={cn(
                          "flex gap-5",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-10 h-10 rounded-2xl bg-white shadow-xl flex items-center justify-center shrink-0 border border-white/60">
                            <Bot className="w-6 h-6 text-primary-600" />
                          </div>
                        )}
                        
                        <div className={cn(
                          "max-w-[85%] sm:max-w-[70%] px-6 py-4 rounded-3xl shadow-xl shadow-slate-900/5 text-sm leading-relaxed relative",
                          msg.role === 'user' 
                            ? "bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-sm" 
                            : "bg-white/80 backdrop-blur-md text-slate-800 border border-white/60 rounded-tl-sm"
                        )}>
                          <div className={cn(
                            "prose prose-sm max-w-none",
                            msg.role === 'user' ? "prose-invert" : "prose-slate"
                          )}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.role === 'assistant' && (
                            <div className="mt-4 pt-4 border-t border-slate-100/50">
                              <p className="text-[10px] leading-tight font-bold text-slate-400 uppercase tracking-tighter opacity-70">
                                Внимание: Это ИИ-ассистент. Для постановки диагноза обратитесь к врачу.
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-5"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-white shadow-xl flex items-center justify-center shrink-0 border border-white/60">
                        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                      </div>
                      <div className="bg-white/60 rounded-3xl rounded-tl-sm px-6 py-4 border border-white/60 shadow-sm">
                         <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" />
                         </div>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center pt-24">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-24 h-24 bg-white rounded-[2rem] border border-white/60 flex items-center justify-center shadow-2xl shadow-primary-500/20 mb-10"
                  >
                    <Stethoscope className="w-12 h-12 text-primary-600" />
                  </motion.div>
                  <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">MediChat Pro</h3>
                  <p className="text-slate-500 text-base mb-10 text-center max-w-sm font-medium leading-relaxed opacity-80">
                    Ваш персональный помощник по вопросам здоровья с поддержкой голосового ввода.
                  </p>
                  <button 
                    onClick={createNewChat}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-black px-10 py-4 rounded-2xl transition-all shadow-xl shadow-primary-600/30 active:scale-95 text-lg"
                  >
                    Начать консультацию
                  </button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 lg:p-10 bg-transparent shrink-0">
            <div className="max-w-3xl mx-auto">
              <form 
                className={cn(
                  "flex gap-3 glass-input p-2.5 rounded-3xl transition-all border-none ring-1 ring-white/60 shadow-2xl",
                  isListening && "ring-red-400 shadow-red-200/50"
                )}
                onSubmit={handleSubmit}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeChat ? "Опишите ваш симптом..." : "Выберите консультацию"}
                  disabled={!activeChat || isLoading}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-base px-5 outline-none font-medium placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={!activeChat || isLoading}
                  className={cn(
                    "p-3 rounded-2xl transition-all active:scale-90",
                    isListening 
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse" 
                      : "text-slate-400 hover:bg-white/60 hover:text-primary-600"
                  )}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || !activeChat || isLoading}
                  className="bg-primary-600 text-white p-3 rounded-2xl hover:bg-primary-700 transition-all disabled:opacity-50 disabled:bg-slate-300 active:scale-90 shadow-lg shadow-primary-600/20"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
              <div className="flex items-center justify-center gap-4 mt-6">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-60 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-400" />
                  GPT-4o Mini
                </span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-60 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-400" />
                  Encrypted
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
