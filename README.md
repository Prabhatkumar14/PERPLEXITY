# SeekrX Pro 🚀

SeekrX is a high-performance, premium AI chatbot and tutor platform built with the MERN stack. It features real-time AI responses, multimodal file support, and an intelligent search grounding system.

## ✨ Key Features

- **Multimodal AI**: Chat with advanced models (Gemini, Mistral) and upload PDFs, Images, or DOCX files for analysis.
- **Search Grounding**: Intelligent search integration via Tavily to provide real-time, factual information.
- **AI Tutor Mode**: Specialized mode for English language learning and grammar suggestions.
- **Premium UI/UX**: Sleek, dark-themed interface with smooth animations and responsive design.
- **Resilient Backend**: Automatic fallback between AI providers to ensure maximum uptime.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS (for custom styling), Lucide Icons.
- **Backend**: Node.js, Express.js, MongoDB (Mongoose).
- **AI Engine**: Google Generative AI (Gemini), Mistral AI, LangChain.
- **Tools**: Multer (file handling), JWT (authentication), Nodemailer.

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/seekrx-pro.git
cd seekrx-pro
```

### 2. Install Dependencies
Install dependencies for both frontend and backend using the root command:
```bash
npm run install-all
```

### 3. Environment Variables
Create `.env` files in both the `backend` and `frontend` directories using the provided `.env.example` templates.

**Backend (.env):**
- `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `TAVILY_API_KEY`
- `MONGODB_URI`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`

**Frontend (.env):**
- `VITE_API_URL=http://localhost:3000`

### 4. Run the Project
Start both the backend and frontend development servers with a single command:
```bash
npm run dev
```

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by [Your Name/Handle]
