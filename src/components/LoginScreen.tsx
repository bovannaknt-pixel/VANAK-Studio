import { useState, FormEvent } from "react";
import { loginUser } from "../utils/api";
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, Watch as WatchIcon, KeyRound, Sparkles } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (role: "owner" | "staff", name: string) => void;
}

export default function LoginScreen(props: LoginScreenProps) {
  const { onLoginSuccess } = props;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedUser = username.trim();
      const res = await loginUser(trimmedUser, password);
      if (res && res.success && res.role && res.name) {
        onLoginSuccess(res.role, res.name);
      } else {
        setError("ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ! Incorrect credentials!");
      }
    } catch (err) {
      setError("មានបញ្ហាក្នុងការទាក់ទងបញ្ជាក់អត្តសញ្ញាណ! Auth server error!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="login-container" 
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative font-sans select-none overflow-hidden bg-slate-950 text-slate-100"
    >
      {/* Absolute Decorative Premium Mesh Gradients */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[130px] -top-80 -left-60 pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[150px] -bottom-80 -right-60 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-amber-500/[0.02] border border-amber-500/10 pointer-events-none animate-[pulse_8s_infinite] -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-amber-500/[0.01] border border-amber-500/5 dashed pointer-events-none animate-[spin_60s_linear_infinite] -z-10" />

      {/* Main Glassmorphic Wrapper */}
      <div className="w-full max-w-[420px] z-10 px-2 animate-fade-in">
        
        {/* Luxury Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5 group">
            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5 shrink-0 transition-all duration-300 group-hover:border-amber-500/50 group-hover:rotate-3">
              <WatchIcon size={42} className="stroke-[1.2] animate-[pulse_4s_infinite]" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-slate-950 shadow-md">
              PRO
            </div>
          </div>
          <h1 className="text-2xl font-black font-serif tracking-[0.14em] text-slate-100 uppercase text-center bg-gradient-to-b from-slate-50 to-slate-300 bg-clip-text text-transparent">
            KUNTHY WATCH
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="h-[1px] w-5 bg-amber-500/40" />
            <p className="text-[10px] text-amber-500 tracking-[0.25em] font-bold uppercase">
              PREMIUM INVENTORY MANAGEMENT
            </p>
            <span className="h-[1px] w-5 bg-amber-500/40" />
          </div>
        </div>

        {/* Form Panel Glassmorphic Card */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/85 rounded-2xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          
          {/* Subtle horizontal gold top border highlight */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-amber-600/10 via-amber-400 to-amber-600/10" />

          <h2 className="text-center text-[12px] font-bold text-slate-300 tracking-wider mb-6 flex items-center justify-center gap-2 font-sans bg-slate-950/50 py-2 border border-slate-800/60 rounded-xl">
            <KeyRound size={14} className="text-amber-500 animate-[bounce_2s_infinite]" />
            ផ្ទាំងចូលប្រើប្រាស់ប្រព័ន្ធ / SYSTEM LOGIN
          </h2>

          {/* Error Notification */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-shake shadow-inner">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5 animate-pulse" />
              <span className="font-sans font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username Input */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                ឈ្មោះគណនី (USERNAME)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-500 transition-colors duration-200 focus-within:text-amber-500">
                  <User size={18} className="stroke-[2]" />
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (e.g. kunthy, pich)"
                  className="w-full bg-slate-950 border border-slate-800/80 text-slate-100 placeholder-slate-600 font-sans pl-10 pr-4 py-3 rounded-xl text-xs focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                លេខសម្ងាត់ (PASSWORD)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-500">
                  <Lock size={18} className="stroke-[2]" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-slate-950 border border-slate-800/80 text-slate-100 placeholder-slate-600 font-sans pl-10 pr-11 py-3 rounded-xl text-xs focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-500 hover:text-slate-300 transition duration-150 cursor-pointer p-0.5 focus:outline-none"
                  title={showPassword ? "លាក់លេខកូដ" : "បង្ហាញលេខកូដ"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center justify-between font-sans text-[11px] pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                  className="hidden"
                />
                <span className={`w-4.5 h-4.5 border border-slate-700 rounded-md flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-slate-950'}`}>
                  {rememberMe && <span className="text-[10px] font-black">✓</span>}
                </span>
                <span>ចងចាំគណនី (Remember me)</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden group hover:opacity-90 disabled:opacity-50 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl tracking-widest text-xs transition-all duration-300 cursor-pointer shadow-lg shadow-amber-500/10 active:scale-[0.98] flex items-center justify-center gap-2 border border-amber-400/25"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4.5 h-4.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>កំពុងផ្ទៀងផ្ទាត់ (LOGGING IN...)</span>
                  </div>
                ) : (
                  <span className="font-sans flex items-center gap-1.5">
                    <ShieldCheck size={15} className="stroke-[2.5]" />
                    ចូលប្រើប្រាស់ប្រព័ន្ធ (SIGN IN)
                  </span>
                )}
              </button>
            </div>

          </form>
        </div>



        {/* Footer info */}
        <p className="mt-10 text-center text-[10px] text-slate-600 font-sans tracking-widest font-semibold uppercase">
          © {new Date().getFullYear()} KUNTHY WATCH STORE. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
