import React, { useState, useRef, useEffect } from "react";
import { Message, ShopData } from "../types";
import { chatWithAI } from "../utils/api";
import { Watch, Send, Sparkles, HelpCircle, Loader2, RefreshCw } from "lucide-react";

interface AIChatSectionProps {
  shopData: ShopData;
}

export default function AIChatSection(props: AIChatSectionProps) {
  const { shopData } = props;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "សួស្តីបាទ! ខ្ញុំជាជំនួយការ AI របស់ហាងលក់នាឡិកាដៃ ChronoManager។\n\nខ្ញុំបានភ្ជាប់ទំនាក់ទំនងជាមួយបញ្ជីស្តុក ការលក់ ចំណូល ចំណាយ និងប្រាក់ដើមក្នុងហាងរបស់អ្នកផ្ទាល់រួចជាស្រេច។ តើខ្ញុំអាចជួយផ្ទៀងផ្ទាត់ ឬធ្វើការគណនាអ្វីជូនលោកអ្នកនៅថ្ងៃនេះដែរ?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const quickQuestions = [
    "តើមាននាឡិកាណាខ្លះដែលជិតអស់ពីស្តុក (ស្តុក < ៥ គ្រឿង)?",
    "សូមបង្ហាញស្ថិតិលក់សរុប ប្រាក់ដើម និងប្រាក់ចំណេញបច្ចុប្បន្ន",
    "សូមជួយគណនាប្រាក់ដើមបច្ចុប្បន្ន និងបញ្ជីចំណាយបច្ចុប្បន្ន",
    "តើមាននាឡិកាម៉ាកអ្វីខ្លះក្នុងហាងរបស់យើងបច្ចុប្បន្ន?",
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Exclude welcome message from history to prevent noise
      const historyForApi = messages
        .filter((m) => m.id !== "welcome")
        .concat(userMessage);

      const aiResponse = await chatWithAI(textToSend, historyForApi, shopData);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: aiResponse,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: "សុំទោសផងបាទ មានបញ្ហាបច្ចេកទេសក្នុងកាភ្ជាប់ទៅកាន់ភ្នាក់ងារ AI។ សូមប្រាកដថាសោរ Gemini API key ត្រូវបានផ្តល់ជូនយ៉ាងត្រឹមត្រូវហើយព្យាយាមម្តងទៀត!",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Safe renderer for simple markdown-like elements (Bold, Lists, Tables)
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    // Detect if content has a markdown table
    const lines = text.split("\n");
    let inTable = false;
    let tableHeaders: string[] = [];
    const tableRows: string[][] = [];
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = (keyIdx: number) => {
      if (currentParagraph.length > 0) {
        elements.push(
          <div key={`p-${keyIdx}`} className="whitespace-pre-line mb-3 leading-relaxed text-sm">
            {parseInlineStyles(currentParagraph.join("\n"))}
          </div>
        );
        currentParagraph = [];
      }
    };

    const parseInlineStyles = (txt: string) => {
      // Simple regex for bold text **text** -> <strong>text</strong>
      const parts = txt.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold text-amber-500 font-sans">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Simple Table detection (starts and ends with | or contains | )
      if (line.startsWith("|") && line.endsWith("|")) {
        flushParagraph(i);
        inTable = true;
        
        // Skip separator line (e.g., |---|---| )
        if (line.includes("---") || line.includes("===")) {
          continue;
        }

        const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      } else {
        if (inTable) {
          // Flush the parsed table
          elements.push(
            <div key={`table-${i}`} className="overflow-x-auto my-4 rounded-xl border border-slate-700 shadow-lg">
              <table className="min-w-full divide-y divide-slate-700 bg-slate-900 text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    {tableHeaders.map((header, hIdx) => (
                      <th key={hIdx} className="px-3 py-2.5 text-left text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 bg-slate-900">
                  {tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 white-space-nowrap text-slate-200">
                          {parseInlineStyles(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          tableHeaders = [];
          tableRows.length = 0;
          inTable = false;
        }

        // Handle Bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          flushParagraph(i);
          elements.push(
            <div key={`bullet-${i}`} className="flex items-start gap-2 ml-4 mb-2 text-sm text-slate-200">
              <span className="text-amber-500 mt-1 md:mt-1.5 shrink-0 block w-1.5 h-1.5 rounded-full bg-amber-400" />
              <div className="flex-1">{parseInlineStyles(line.substring(2))}</div>
            </div>
          );
        } else if (line.match(/^\d+\.\s/)) {
          flushParagraph(i);
          const parts = line.split(/^\d+\.\s/);
          elements.push(
            <div key={`num-${i}`} className="flex items-start gap-2 ml-4 mb-2 text-sm text-slate-200">
              <span className="text-amber-400 font-bold font-sans shrink-0 block">{line.match(/^\d+/)?.[0]}.</span>
              <div className="flex-1">{parseInlineStyles(parts[1] || "")}</div>
            </div>
          );
        } else {
          currentParagraph.push(lines[i]);
        }
      }
    }

    flushParagraph(lines.length);

    // If remaining table is still in buffer
    if (inTable && tableHeaders.length > 0) {
      elements.push(
        <div key="table-final" className="overflow-x-auto my-4 rounded-xl border border-slate-700 shadow-lg">
          <table className="min-w-full divide-y divide-slate-700 bg-slate-900 text-xs">
            <thead className="bg-slate-800">
              <tr>
                {tableHeaders.map((header, hIdx) => (
                  <th key={hIdx} className="px-3 py-2.5 text-left text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 bg-slate-900">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/10 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 white-space-nowrap text-slate-200 font-sans">
                      {parseInlineStyles(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] min-h-[500px]">
      
      {/* Messages Window (3 cols) */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-full">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                ជំនួយការឆ្លាតវៃ AI Chrono
              </h2>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                កំពុងភ្ជាប់ទិន្នន័យផ្សាយផ្ទាល់ (Live Context Linked)
              </p>
            </div>
          </div>
          <button
            onClick={() => setMessages([
              {
                id: "welcome",
                sender: "assistant",
                text: "សួស្តីបាទ! ខ្ញុំជាជំនួយការ AI របស់ហាងលក់នាឡិកាដៃ ChronoManager។\n\nខ្ញុំបានភ្ជាប់ទំនាក់ទំនងជាមួយបញ្ជីស្តុក ការលក់ ចំណូល ចំណាយ និងប្រាក់ដើមក្នុងហាងរបស់អ្នកផ្ទាល់រួចជាស្រេច។ តើខ្ញុំអាចជួយផ្ទៀងផ្ទាត់ ឬធ្វើការគណនាអ្វីជូនលោកអ្នកនៅថ្ងៃនេះដែរ?",
                timestamp: new Date().toLocaleTimeString(),
              }
            ])}
            title="សម្អាតការសន្ទនា"
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw size={14} className="stroke-[1.5]" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans bg-slate-950/20">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-md ${
                  m.sender === "user"
                    ? "bg-amber-500 text-slate-950 rounded-br-none"
                    : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-bl-none"
                }`}
              >
                {/* Body */}
                <div className="text-sm font-sans whitespace-pre-wrap leading-relaxed">
                  {m.sender === "user" ? m.text : renderMessageContent(m.text)}
                </div>

                {/* Sender/Time footer */}
                <div
                  className={`text-[10px] mt-2 block ${
                    m.sender === "user" ? "text-slate-800/80 font-medium" : "text-slate-400 font-normal"
                  }`}
                >
                  {m.sender === "user" ? "អ្នកប្រើប្រាស់" : "AI Chrono"} • {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] md:max-w-[70%] bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-none p-4 shadow-md text-slate-300">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-amber-500" />
                  <span className="text-xs text-slate-400 font-light">AI Chrono កំពុងវិភាគស្ថិតិ និងទិន្នន័យហាង...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Form Input */}
        <form
          className="p-4 bg-slate-800/30 border-t border-slate-800 flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
        >
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="សួរសំណួរទៅកាន់ AI (ឧទាហរណ៍៖ 'តើសរុបការលក់បានប៉ុន្មាន?', 'នាឡិកាណាអស់ពីស្តុក?')"
            className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            id="send-chat-btn"
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors cursor-pointer"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Suggested Side panel (1 col) */}
      <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full overflow-y-auto">
        <h3 className="text-xs font-semibold text-amber-400 tracking-wider uppercase mb-4 flex items-center gap-1.5 font-sans">
          <HelpCircle size={14} />
          សំណួរពេញនិយម
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
          ចុចលើសំណួរខាងក្រោម ដើម្បីឱ្យ AI Chrono ជួយត្រួតពិនិត្យ គណនា និងរៀបចំជារាយការណ៍តារាងជូនភ្លាមៗ៖
        </p>
        <div className="space-y-3 flex-1 font-sans">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="w-full text-left p-3.5 bg-slate-950/60 hover:bg-slate-950 hover:border-amber-500/50 border border-slate-800 rounded-xl text-xs text-slate-300 hover:text-amber-300 transition-all cursor-pointer leading-relaxed shadow-sm flex items-start gap-2.5"
            >
              <Watch size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <span>{q}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center font-sans">
          💡 AI មិនបង្កើតទិន្នន័យក្លែងក្លាយទេ គ្រប់ចម្លើយទាំងអស់គឺជារបាយការណ៍ពិតរបស់ហាង។
        </div>
      </div>

    </div>
  );
}
