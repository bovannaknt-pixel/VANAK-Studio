import React, { useEffect, useState } from "react";
import { QrCode, Check, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Watch } from "../types";

interface ScanWatchCodeProps {
  watchId: string;
  setWatchId: (id: string) => void;
  watches: Watch[];
  editingWatchId: string | null;
  language: "kh" | "en";
  onScanClick: () => void;
  lastScanTime: number; // timestamp to trigger the scan success animation
}

export default function ScanWatchCode({
  watchId,
  setWatchId,
  watches,
  editingWatchId,
  language,
  onScanClick,
  lastScanTime,
}: ScanWatchCodeProps) {
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  // Trigger scan success indicator animation
  useEffect(() => {
    if (lastScanTime > 0) {
      setShowSuccessAnim(true);
      const timer = setTimeout(() => {
        setShowSuccessAnim(false);
      }, 3000); // Animation and indicator visible for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [lastScanTime]);

  // Validation Logic
  const getValidationState = () => {
    const trimmed = watchId.trim();
    if (trimmed === "") {
      return {
        status: "empty",
        messageKh: "សូមបញ្ចូលលេខកូដនាឡិកា (SKU / ID)",
        messageEn: "Please enter a watch SKU / ID",
        color: "text-slate-500",
        isValid: false,
      };
    }

    if (/\s/.test(trimmed)) {
      return {
        status: "invalid-space",
        messageKh: "❌ លេខកូដមិនត្រូវមានចន្លោះទំនេរ (Space) ឡើយ",
        messageEn: "❌ Code should not contain spaces",
        color: "text-rose-400 font-medium",
        isValid: false,
      };
    }

    if (trimmed.length < 3) {
      return {
        status: "too-short",
        messageKh: "❌ លេខកូដត្រូវមានយ៉ាងតិច ៣ តួអក្សរ",
        messageEn: "❌ SKU must be at least 3 characters",
        color: "text-rose-400 font-medium",
        isValid: false,
      };
    }

    // Checking if SKU exists in DB
    const matchedWatch = watches.find((w) => w.id === trimmed);

    if (editingWatchId) {
      // We are in edit mode
      if (trimmed === editingWatchId) {
        return {
          status: "editing-current",
          messageKh: "⚡ កំពុងកែប្រែនាឡិកាដដែលនេះ",
          messageEn: "⚡ Editing this original watch SKU",
          color: "text-amber-400 font-semibold",
          isValid: true,
          match: matchedWatch,
        };
      } else if (matchedWatch) {
        return {
          status: "duplicate-error",
          messageKh: "❌ លេខកូដនេះមានរួចហើយ! មិនអាចប្តូរទៅជាន់គ្នាបានទេ",
          messageEn: "❌ SKU already exists! Cannot duplicate ID",
          color: "text-rose-400 font-semibold",
          isValid: false,
        };
      }
    } else {
      // We are in creation mode
      if (matchedWatch) {
        return {
          status: "exists-restock",
          messageKh: `⚠️ មានក្នុងស្តុក៖ ${matchedWatch.brand} - ${matchedWatch.model} (ចុចស្កេន/រក្សាទុកដើម្បីកែប្រែ ឬបន្ថែមចំនួន)`,
          messageEn: `⚠️ Exists: ${matchedWatch.brand} - ${matchedWatch.model} (Will edit or restock this item)`,
          color: "text-amber-500 font-semibold",
          isValid: true,
          match: matchedWatch,
        };
      }
    }

    // Perfect Unique SKU
    return {
      status: "unique",
      messageKh: "✨ លេខកូដថ្មីប្លែកគេ៖ ត្រៀមចុះឈ្មោះនាឡិកាថ្មី!",
      messageEn: "✨ Unique SKU: Ready to register as a new watch!",
      color: "text-emerald-400 font-semibold",
      isValid: true,
    };
  };

  const validation = getValidationState();

  return (
    <div className="space-y-1.5 font-sans relative">
      <div className="flex justify-between items-center">
        <label htmlFor="watch-id" className="block text-slate-400 text-xs font-semibold tracking-wider uppercase">
          {language === "kh" ? "លេខកូដនាឡិកា (ID / SKU) *" : "Watch SKU / ID *"}
        </label>
        
        {/* Simple inline live badge */}
        <AnimatePresence mode="wait">
          {validation.isValid && (
            <motion.span
              key={validation.status}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                validation.status.includes("exists") || validation.status.includes("editing")
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {validation.status.includes("exists") || validation.status.includes("editing")
                ? (language === "kh" ? "មានស្រាប់" : "Existing")
                : (language === "kh" ? "ថ្មី" : "New SKU")}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        {/* Glow border on success scan */}
        <div
          className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 blur transition-all duration-700 pointer-events-none ${
            showSuccessAnim ? "opacity-45 scale-100" : "scale-95"
          }`}
        />

        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              id="watch-id"
              type="text"
              required
              value={watchId}
              onChange={(e) => setWatchId(e.target.value)}
              placeholder="ឧ. ROLEX-SUB-202"
              className={`w-full bg-slate-950 border text-slate-100 placeholder-slate-600 rounded-lg py-2.5 px-3.5 pl-3.5 pr-10 text-xs focus:outline-none font-mono transition-all duration-300 ${
                showSuccessAnim
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : validation.isValid
                  ? "border-slate-800 focus:border-amber-500"
                  : watchId.trim() !== ""
                  ? "border-rose-500/60 focus:border-rose-500"
                  : "border-slate-800 focus:border-amber-500"
              }`}
            />

            {/* Success indicator checkmark inside input */}
            <AnimatePresence>
              {(showSuccessAnim || (validation.isValid && watchId.trim() !== "")) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center"
                >
                  {showSuccessAnim ? (
                    <div className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 py-0.5 px-1.5 rounded-md border border-emerald-500/25">
                      <CheckCircle2 size={12} className="animate-bounce" />
                      <span className="text-[9px] font-bold font-sans tracking-wide">
                        {language === "kh" ? "ស្កេនជោគជ័យ" : "SCANNED"}
                      </span>
                    </div>
                  ) : (
                    <Check
                      size={14}
                      className={
                        validation.status.includes("exists") || validation.status.includes("editing")
                          ? "text-amber-500"
                          : "text-emerald-400"
                      }
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onScanClick}
            className={`border rounded-lg px-4 py-2.5 text-xs transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md font-medium ${
              showSuccessAnim
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                : "bg-slate-850 hover:bg-slate-800 text-amber-500 hover:text-amber-400 border-slate-850 hover:border-amber-500/30"
            }`}
            title={language === "kh" ? "ស្កេន QR នាឡិកា" : "Scan Watch QR"}
          >
            <motion.div
              animate={showSuccessAnim ? { rotate: [0, 15, -15, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <QrCode size={14} />
            </motion.div>
            <span>{language === "kh" ? "ស្កេន QR" : "Scan QR"}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Validation Status / Auto-validation feedback message */}
      <div className="h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={validation.status + "-" + watchId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={`text-[10px] leading-relaxed transition-all ${validation.color}`}
          >
            {language === "kh" ? validation.messageKh : validation.messageEn}
          </motion.p>
        </AnimatePresence>
      </div>

    </div>
  );
}
