import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Plus, MessageSquare, Menu, User, Sparkles, LogOut, 
  Loader2, Trash2, ChevronDown, Cpu, Paperclip, X, 
  Search, Download, Mic, MicOff, Copy, Check, Terminal, Camera, Volume2, VolumeX, CheckCircle, AlertCircle 
} from 'lucide-react';
import { login, register, getMe, logout, getChats, createChat, getMessages, sendMessage, deleteChat, checkGrammar, API_URL } from './api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

// --- Tutor Pro Components ---
const MetricBar = ({ label, value, icon }) => (
  <div className="metric-item">
    <div className="metric-header">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}%</span>
    </div>
    <div className="metric-track">
      <div className="metric-fill" style={{ width: `${value}%`, background: value > 70 ? '#10b981' : value > 40 ? '#f59e0b' : '#ef4444' }}></div>
    </div>
  </div>
);

const TutorResponse = ({ data, onPracticeAgain }) => {
  if (!data) return null;
  const { conversationalResponse, hindiExplanation, corrections, betterVersion, metrics, fillersDetected, practiceTask } = data;

  return (
    <div className="tutor-response-container">
      <div className="tutor-header-msg">
        <p className="conv-res">{conversationalResponse}</p>
        {hindiExplanation && <p className="hindi-exp">{hindiExplanation}</p>}
      </div>

      {metrics && (
        <div className="metrics-grid">
          <MetricBar label="Confidence" value={metrics.confidence} />
          <MetricBar label="Fluency" value={metrics.fluency} />
          <MetricBar label="Interview Ready" value={metrics.interviewReadiness} />
          <MetricBar label="Grammar" value={metrics.grammar} />
        </div>
      )}

      {corrections && corrections.length > 0 && (
        <div className="tutor-section">
          <h4 className="section-title"><CheckCircle size={16} /> Corrections</h4>
          <div className="corrections-list">
            {corrections.map((c, i) => (
              <div key={i} className="correction-card">
                <div className="diff-view">
                  <span className="orig-text">❌ {c.original}</span>
                  <span className="corr-text">✅ {c.corrected}</span>
                </div>
                {c.why && <p className="why-text"><strong>Why?</strong> {c.why}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {fillersDetected && fillersDetected.length > 0 && (
        <div className="tutor-section fillers">
          <h4 className="section-title"><AlertCircle size={16} /> Fillers Detected</h4>
          <div className="filler-tags">
            {fillersDetected.map((f, i) => <span key={i} className="filler-tag">{f}</span>)}
          </div>
        </div>
      )}

      {betterVersion && (
        <div className="tutor-section">
          <h4 className="section-title"><Sparkles size={16} /> Better Version</h4>
          <div className="better-version-box">
            <p>{betterVersion}</p>
          </div>
        </div>
      )}

      {practiceTask && (
        <div className="practice-loop-card">
          <h4 className="section-title"><Mic size={16} /> Practice Again</h4>
          <p className="practice-text">"{practiceTask}"</p>
          <button className="practice-btn" onClick={() => onPracticeAgain(practiceTask)}>
            Try Speaking This
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');

  // Chat State
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [chatError, setChatError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // Grammar Suggestions State
  const [grammarSuggestion, setGrammarSuggestion] = useState(null);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copySuccess, setCopySuccess] = useState({}); // { messageId: boolean }
  const [isSpeaking, setIsSpeaking] = useState(null); // stores messageId
  const [persona, setPersona] = useState('general');
  const [tutorLevel, setTutorLevel] = useState('beginner'); // beginner, intermediate, advanced
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    
    // Auto-speak for Tutor Persona
    if (persona === 'tutor' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'ai' && !isLoading && isSpeaking !== lastMsg._id) {
        // Prevent repeating the same message
        const lastSpokenId = sessionStorage.getItem('lastSpokenId');
        if (lastSpokenId !== lastMsg._id) {
          handleSpeak(lastMsg.content, lastMsg._id);
          sessionStorage.setItem('lastSpokenId', lastMsg._id);
        }
      }
    }
  }, [messages, isLoading, persona]);

  // Manual Grammar Check
  const handleGrammarCheck = async () => {
    if (!input.trim() || input.trim().length < 5) {
      setGrammarSuggestion(null);
      return;
    }
    setIsCheckingGrammar(true);
    try {
      const res = await checkGrammar(input, provider);
      if (res.data.success && res.data.correction) {
        setGrammarSuggestion(res.data.correction);
      } else {
        setGrammarSuggestion(null);
      }
    } catch (err) {
      console.error("Grammar check failed", err);
      setGrammarSuggestion(null);
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  // Clear suggestions if input becomes empty
  useEffect(() => {
    if (!input.trim()) {
      setGrammarSuggestion(null);
    }
  }, [input]);

  const applySuggestion = () => {
    if (grammarSuggestion) {
      setInput(grammarSuggestion);
      setGrammarSuggestion(null);
    }
  };

  // Check if logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await getMe();
        if (res.data.success) {
          setUser(res.data.user);
          loadChats();
        }
      } catch (err) {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadChats = async () => {
    try {
      const res = await getChats();
      if (res.data.success) {
        setChats(res.data.chats);
      }
    } catch (err) {
      console.error("Failed to load chats", err);
    }
  };

  const loadMessages = async (chatId) => {
    setIsLoading(true);
    try {
      const res = await getMessages(chatId);
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    setSidebarOpen(false);
    loadMessages(chat._id);
  };

  const handleNewChat = async () => {
    try {
      const res = await createChat("New Chat");
      if (res.data.success) {
        const newChat = res.data.chat;
        setChats([newChat, ...chats]);
        setActiveChat(newChat);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create chat", err);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    try {
      await deleteChat(chatId);
      setChats(chats.filter(c => c._id !== chatId));
      if (activeChat?._id === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    let currentChatId = activeChat?._id;
    
    // Create chat on the fly if none is active
    if (!currentChatId) {
      try {
        const res = await createChat("New Chat");
        currentChatId = res.data.chat._id;
        setActiveChat(res.data.chat);
        setChats([res.data.chat, ...chats]);
      } catch (err) {
        console.error("Failed to create chat", err);
        return;
      }
    }

    const messageText = input;
    const fileToSend = selectedFile;
    setInput('');
    setSelectedFile(null);
    setChatError('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg = { _id: Date.now().toString(), role: 'user', content: fileToSend ? `[Attached File: ${fileToSend.name}]\n${messageText}` : messageText };
    const tempAiMsg = { _id: (Date.now() + 1).toString(), role: 'ai', content: '' };
    setMessages(prev => [...prev, tempUserMsg, tempAiMsg]);

    try {
      let response;
      if (fileToSend) {
        const formData = new FormData();
        formData.append('chatId', currentChatId);
        formData.append('content', messageText);
        formData.append('provider', provider);
        formData.append('persona', persona);
        formData.append('tutorLevel', tutorLevel);
        formData.append('file', fileToSend);

        response = await fetch(`${API_URL}/api/message/stream`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
      } else {
        response = await fetch(`${API_URL}/api/message/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            chatId: currentChatId, 
            content: messageText, 
            provider: provider,
            persona: persona,
            tutorLevel: tutorLevel
          })
        });
      }

      if (!response.ok) throw new Error("Failed to start stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setMessages(prev => prev.map(m => 
                  m._id === tempAiMsg._id ? { ...m, content: fullContent } : m
                ));
              }
              if (data.done) {
                // Replace temp messages with real ones from DB
                setMessages(prev => {
                   const filtered = prev.filter(m => m._id !== tempUserMsg._id && m._id !== tempAiMsg._id);
                   return [...filtered, data.userMessage, data.aiMessage];
                });
                
                if (data.chatTitle) {
                  loadChats(); // Refresh titles
                }
              }
            } catch (e) { console.error("Parse error", e); }
          }
        }
      }
    } catch (err) {
      console.error("Failed to send message", err);
      setChatError(err.message || 'Unable to get a response from SeekrX.');
      // Remove the empty AI message on error
      setMessages(prev => prev.filter(m => m._id !== tempAiMsg._id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    
    // Slash Command Logic
    if (val.endsWith('/')) {
      setShowSlashMenu(true);
    } else if (!val.includes('/')) {
      setShowSlashMenu(false);
    }
  };

  const handleSlashCommand = (cmd) => {
    const commands = {
      summarize: "Summarize our conversation so far.",
      fix: "Fix the grammar and spelling of this message: ",
      code: "Explain this code in detail: ",
      translate: "Translate this message into Hindi: "
    };
    setInput(commands[cmd] || "");
    setShowSlashMenu(false);
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleVoiceInput = async () => {
    // If in Tutor mode, we record raw audio to send to Gemini
    if (persona === 'tutor') {
      if (isListening) {
        mediaRecorderRef.current.stop();
        setIsListening(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], "recorded_speech.webm", { type: 'audio/webm' });
          setSelectedFile(audioFile);
          // Auto-send if in tutor mode for seamless experience
          setTimeout(() => handleSend(), 500); 
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (err) {
        console.error("Audio capture failed:", err);
        alert("Could not access microphone for audio analysis.");
      }
      return;
    }

    // Default Speech-to-Text for other modes
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        setSelectedFile(file);
        stopCamera();
      }, 'image/jpeg');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    const tracks = stream?.getTracks();
    tracks?.forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const handleExportChat = () => {
    if (!messages.length) return;
    const content = messages.map(m => `### ${m.role === 'ai' ? 'SeekrX' : 'User'}\n\n${m.content}\n\n---`).join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SeekrX_Chat_${activeChat?.title || 'Export'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess({ ...copySuccess, [id]: true });
      setTimeout(() => setCopySuccess(prev => ({ ...prev, [id]: false })), 2000);
    });
  };

  const handleSpeak = (text, id) => {
    if (isSpeaking === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    let textToSpeak = text;
    // If it's a JSON response from tutor, only speak the conversational part
    try {
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        textToSpeak = data.conversationalResponse || text;
      }
    } catch (e) {}

    // Remove markdown symbols for cleaner speech
    const cleanText = textToSpeak.replace(/[*#`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Detect Hindi characters
    const hasHindi = /[\u0900-\u097F]/.test(text);
    
    // Find best voice (Hindi if needed, else Indian English for Hinglish)
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (hasHindi) {
      selectedVoice = voices.find(v => v.lang.includes('hi-IN'));
      utterance.lang = 'hi-IN';
    } else {
      // For Hinglish, Indian English accent sounds much better than US accent
      selectedVoice = voices.find(v => v.lang.includes('en-IN')) || voices.find(v => v.lang.includes('en-GB'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);
    
    setIsSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const prompts = [
    { label: 'Summarize', icon: <Sparkles size={14}/>, text: 'Summarize the above conversation so far.' },
    { label: 'Fix Grammar', icon: <Terminal size={14}/>, text: 'Check the grammar of my last message and suggest improvements.' },
    { label: 'Explain Code', icon: <Cpu size={14}/>, text: 'Explain the code provided in this chat step-by-step.' },
    { label: 'Translate', icon: <User size={14}/>, text: 'Translate my last message to Hindi.' }
  ];

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        await register(username, email, password);
        setAuthError('Registration successful. Please verify email and login.');
        setIsRegister(false);
      } else {
        const res = await login(email, password);
        if (res.data.success) {
          setUser(res.data.user);
          loadChats();
        }
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Authentication failed');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setChats([]);
      setActiveChat(null);
      setMessages([]);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (authLoading) return <div className="app-container" style={{justifyContent:'center', alignItems:'center'}}><Loader2 className="spinner" /></div>;

  // --- Auth Screen ---
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-header">
            <img src="/assets/logo.png" alt="SeekrX Logo" className="logo-image" style={{width:'60px', height:'60px'}}/>
            <h1 className="text-gradient">SeekrX</h1>
            <p>{isRegister ? 'Create an account to start' : 'Welcome back, please login'}</p>
          </div>
          <form onSubmit={handleAuth} className="auth-form">
            {isRegister && (
              <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
            )}
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit" className="auth-btn">{isRegister ? 'Register' : 'Login'}</button>
          </form>
          <button className="auth-switch" onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}>
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    );
  }

  // --- Chat Screen ---
  return (
    <div className={`app-container ${persona}-mode`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/assets/logo.png" alt="SeekrX Logo" className="logo-image" />
          <span className="logo-text text-gradient">SeekrX</span>
        </div>
        
        <button className="new-chat-btn" onClick={handleNewChat}>
          <Plus size={18} />
          New Chat
        </button>

        <div className="sidebar-search-container">
          <div style={{position: 'relative'}}>
            <Search size={14} style={{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
            <input 
              className="sidebar-search" 
              placeholder="Search chats..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{paddingLeft: '32px'}}
            />
          </div>
        </div>
        
        <div className="chat-list">
          {filteredChats.map(chat => (
            <div 
              key={chat._id} 
              className={`chat-item ${activeChat?._id === chat._id ? 'active' : ''}`}
              onClick={() => handleChatSelect(chat)}
            >
              <MessageSquare size={18} />
              <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{chat.title}</span>
              <button className="delete-chat-btn" onClick={(e) => handleDeleteChat(e, chat._id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {chats.length === 0 && <div style={{padding:'20px', color:'var(--text-muted)', textAlign:'center'}}>No chats yet</div>}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={handleLogout} title="Click to logout">
            <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
            <span style={{flex:1}}>{user.username}</span>
            <LogOut size={16} color="var(--text-muted)" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="mobile-header">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          <span className="logo-text text-gradient">SeekrX</span>
          <div style={{ width: '24px' }}></div> {/* Spacer to center title */}
        </div>

        <div className="header-actions">
           <button className="utility-btn" onClick={handleExportChat} title="Export Chat">
             <Download size={18} />
           </button>
        </div>

        <div className="chat-area">
          {!activeChat && messages.length === 0 ? (
            <div className="empty-state">
              <img src="/assets/logo.png" alt="SeekrX Logo" className="empty-logo" />
              <h1 className="text-gradient">How can I help you today?</h1>
              <p>SeekrX is ready to search, analyze, and assist you with anything.</p>
            </div>
          ) : (
            <div className="message-container">
              {messages.map((msg) => (
                <div key={msg._id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'ai' ? <Sparkles size={20} color="white" /> : <User size={20} color="white" />}
                  </div>
                  <div className="message-bubble">
                    {persona === 'tutor' && msg.role === 'ai' && msg.content.trim().startsWith('{') ? (
                      (() => {
                        try {
                          const tutorData = JSON.parse(msg.content);
                          return <TutorResponse data={tutorData} onPracticeAgain={(task) => { setInput(task); handleVoiceInput(); }} />;
                        } catch (e) {
                          // While streaming JSON, show a loader instead of raw JSON
                          return (
                            <div className="tutor-loading">
                              <Loader2 className="spinner" size={20} />
                              <span>Analyzing your speech and generating feedback...</span>
                            </div>
                          );
                        }
                      })()
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeText = String(children).replace(/\n$/, '');
                          return !inline && match ? (
                            <div className="code-container">
                              <div className="code-header">
                                <span>{match[1].toUpperCase()}</span>
                                <button 
                                  className="copy-btn" 
                                  onClick={() => handleCopyToClipboard(codeText, msg._id)}
                                >
                                  {copySuccess[msg._id] ? <Check size={14} /> : <Copy size={14} />}
                                  {copySuccess[msg._id] ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <SyntaxHighlighter
                                children={codeText}
                                style={atomDark}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              />
                            </div>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    )}
                    {msg.role === 'ai' && (
                      <div className="message-actions">
                        <button 
                          className={`action-icon-btn ${isSpeaking === msg._id ? 'speaking' : ''}`} 
                          onClick={() => handleSpeak(msg.content, msg._id)}
                          title={isSpeaking === msg._id ? "Stop Speaking" : "Listen Message"}
                        >
                          {isSpeaking === msg._id ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message ai">
                   <div className="message-avatar"><Sparkles size={20} color="white" /></div>
                   <div className="message-bubble"><Loader2 size={20} className="spinner" /></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="input-area-wrapper" style={{ flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Model & Persona Selector (Merged for Clean UI) */}
          <div className="model-dropdown-container">
            <button 
              className="model-dropdown-btn" 
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            >
              <Cpu size={16} />
              <span>{provider === 'gemini' ? 'SeekrX 2.5' : 'SeekrNew'}</span>
              <span className="persona-tag">({persona})</span>
              <ChevronDown size={14} className={`dropdown-icon ${isModelDropdownOpen ? 'open' : ''}`} />
            </button>
            
            {isModelDropdownOpen && (
              <div className="model-dropdown-menu">
                <div className="dropdown-section">
                  <span className="section-label">AI Model</span>
                  <button 
                    className={`model-option ${provider === 'gemini' ? 'active' : ''}`}
                    onClick={() => { setProvider('gemini'); setIsModelDropdownOpen(false); }}
                  >
                    SeekrX 2.5 (Flash)
                  </button>
                  <button 
                    className={`model-option ${provider === 'mistral' ? 'active' : ''}`}
                    onClick={() => { setProvider('mistral'); setIsModelDropdownOpen(false); }}
                  >
                    SeekrNew (Pro)
                  </button>
                </div>
                
                <div className="dropdown-divider"></div>
                
                <div className="dropdown-section">
                  <span className="section-label">Persona Mode</span>
                  <button 
                    className={`model-option ${persona === 'general' ? 'active' : ''}`}
                    onClick={() => { setPersona('general'); setIsModelDropdownOpen(false); }}
                  >
                    General Assistant
                  </button>
                  <button 
                    className={`model-option ${persona === 'coder' ? 'active' : ''}`}
                    onClick={() => { setPersona('coder'); setIsModelDropdownOpen(false); }}
                  >
                    Expert Coder
                  </button>
                  <button 
                    className={`model-option ${persona === 'creative' ? 'active' : ''}`}
                    onClick={() => { setPersona('creative'); setIsModelDropdownOpen(false); }}
                  >
                    Creative Writer
                  </button>
                  <button 
                    className={`model-option ${persona === 'tutor' ? 'active' : ''}`}
                    onClick={() => { setPersona('tutor'); setIsModelDropdownOpen(false); }}
                  >
                    Spoken English Tutor
                  </button>
                </div>

                {persona === 'tutor' && (
                  <>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-section">
                      <span className="section-label">Tutor Level</span>
                      <div className="level-toggle">
                        {['beginner', 'intermediate', 'advanced'].map(lvl => (
                          <button 
                            key={lvl}
                            className={`level-btn ${tutorLevel === lvl ? 'active' : ''}`}
                            onClick={() => setTutorLevel(lvl)}
                          >
                            {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Grammar Suggestions Bar */}
          {grammarSuggestion && (
            <div className="suggestions-bar">
              <button 
                className="suggestion-chip"
                onClick={applySuggestion}
                title="Click to apply"
              >
                <Sparkles size={14} color="var(--accent-cyan)" />
                <span className="correct-text">{grammarSuggestion}</span>
              </button>
            </div>
          )}
          {isCheckingGrammar && !grammarSuggestion && (
            <div className="suggestions-bar">
              <div className="suggestion-chip" style={{cursor: 'default', opacity: 0.7}}>
                <Loader2 size={14} className="spinner" />
                <span style={{fontSize: '0.8rem'}}>Checking phrasing...</span>
              </div>
            </div>
          )}

          {chatError && (
            <div className="chat-error-banner" style={{ color: '#ff6b6b', padding: '10px 12px', borderRadius: '10px', marginBottom: '10px', width: '100%', textAlign: 'center', background: 'rgba(255,107,107,0.12)' }}>
              {chatError}
            </div>
          )}

          <div className="input-container">
            {showSlashMenu && (
              <div className="slash-menu">
                <div className="slash-item" onClick={() => handleSlashCommand('summarize')}>/summarize — <span>Summarize chat</span></div>
                <div className="slash-item" onClick={() => handleSlashCommand('fix')}>/fix — <span>Fix grammar</span></div>
                <div className="slash-item" onClick={() => handleSlashCommand('code')}>/code — <span>Explain code</span></div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
                e.target.value = null; // reset so same file can be selected again
              }}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            
            <div className="input-content-wrapper">
              {/* File Attachment Preview */}
              {selectedFile && (
                <div className="file-attachment-chip">
                  <div className="chip-icon">
                    <Paperclip size={14} />
                  </div>
                  <div className="chip-info">
                    <span className="chip-name">{selectedFile.name}</span>
                    <span className="chip-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button className="chip-remove" onClick={() => setSelectedFile(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="input-row">
                <button 
                  className="input-action-btn" 
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File"
                >
                  <Paperclip size={20} color={selectedFile ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                </button>
                <button 
                  className="input-action-btn" 
                  onClick={handleGrammarCheck}
                  disabled={isCheckingGrammar || !input.trim()}
                  title="Fix Grammar"
                >
                  <Sparkles size={20} color="var(--accent-cyan)" />
                </button>
                <button 
                  className={`input-action-btn voice-btn ${isListening ? 'active' : ''}`} 
                  onClick={handleVoiceInput}
                  title="Voice Input"
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button 
                  className="input-action-btn" 
                  onClick={startCamera}
                  title="Open Camera"
                >
                  <Camera size={20} color="var(--accent-cyan)" />
                </button>
                <textarea
                  className="chat-input"
                  placeholder="Message SeekrX..."
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                />
                <button 
                  className="send-btn" 
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                >
                  {isLoading ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Camera Modal Overlay */}
      {isCameraOpen && (
        <div className="camera-overlay">
          <div className="camera-box">
            <video ref={videoRef} autoPlay playsInline className="camera-video" />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="camera-controls">
              <button className="camera-btn capture" onClick={capturePhoto}>Capture</button>
              <button className="camera-btn cancel" onClick={stopCamera}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
