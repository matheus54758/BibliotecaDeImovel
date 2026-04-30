import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { InputField } from "../components/InputField";
import { loginSchema, type LoginInput } from "../lib/schemas";

export const Login = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setAuthError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) throw signInError;

      navigate("/");
    } catch (err: any) {
      setAuthError(err.message || "An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-4 md:p-8 relative">
      <main className="w-full max-w-6xl h-[800px] max-h-[921px] bg-surface-container-lowest rounded-xl flex flex-col md:flex-row overflow-hidden shadow-[0_12px_40px_rgba(11,28,48,0.06)] relative">
        {/* Language Switcher - Moved inside main for better visibility and relative positioning */}
        <div className="absolute top-6 right-6 z-[60]" ref={langMenuRef}>
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="bg-surface-container-lowest/80 backdrop-blur-sm text-on-surface hover:bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-xl">language</span>
            <span className="text-sm font-medium">{languages.find(l => i18n.language.startsWith(l.code))?.name || 'Language'}</span>
          </button>
          
          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-[70] overflow-hidden py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-high transition-colors flex items-center space-x-3 ${
                    i18n.language.startsWith(lang.code) ? 'text-primary font-bold bg-primary/5' : 'text-on-surface'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="hidden md:block md:w-1/2 relative bg-surface-container">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD7HdK0Ds-_ZYLiSvsC4XZEXuH-Uv3o2D_MrnY2VolDZOZzoJIp1zgsnAOjHcTemDpjsbvY62VSnl7ItK9xdMBSuQucM1xlHNASGHYhQ5goDAIcqQRkhPRA8hzO_VvyZBQQKmffHBAdBa1BwUxw-EeFHklqnQJsvtGHa7s5KMm64a79T_RfLawrQ-v9aTKORedSZNmTgmYIPv67TWvDwJDUHzqHEC-bwBZQ8LCT7taH14ghFqNfifAV58lA-tPR-cSKe3A-3cAcX8ri')",
            }}
          ></div>
          <div className="absolute bottom-12 left-12 right-12 glass-panel p-8 rounded-lg">
            <h2 className="font-headline font-bold text-3xl text-on-surface mb-2 tracking-tight">
              {t('login.title')}
            </h2>
            <p className="font-body text-on-surface-variant text-sm leading-relaxed">
              {t('login.subtitle')}
            </p>
          </div>
        </section>

        <section className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-surface-container-lowest relative">
          <div className="md:hidden mb-12 text-center">
            <h1 className="font-headline font-black text-2xl text-on-background tracking-tighter">{t('login.title')}</h1>
          </div>
          <div className="max-w-md w-full mx-auto">
            <div className="mb-10">
              <h1 className="font-headline font-extrabold text-4xl text-on-background mb-3 tracking-[-0.02em]">
                {t('login.welcome')}
              </h1>
              <p className="font-body text-on-surface-variant text-base">{t('login.enter_details')}</p>
            </div>

            {authError && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                {authError}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <InputField 
                label={t('login.email')}
                type="email"
                icon="mail"
                placeholder="consultant@ledger.com"
                {...register("email")}
                error={errors.email?.message}
              />

              <InputField 
                label={t('login.password')}
                type="password"
                icon="lock"
                placeholder="••••••••"
                {...register("password")}
                error={errors.password?.message}
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center">
                  <input
                    className="h-4 w-4 text-primary bg-surface-container-high border-0 rounded focus:ring-primary focus:ring-offset-background"
                    id="remember-me"
                    type="checkbox"
                  />
                  <label className="ml-3 block text-sm font-body text-on-surface-variant" htmlFor="remember-me">
                    {t('login.remember')}
                  </label>
                </div>
                <div className="text-sm">
                  <a className="font-body font-medium text-primary hover:text-primary-container transition-colors" href="#">
                    {t('login.forgot')}
                  </a>
                </div>
              </div>
              
              <div className="pt-4">
                <Button className="w-full py-4 text-base font-bold" type="submit" disabled={loading}>
                  {loading ? t('login.signing_in') : t('login.sign_in')}
                </Button>
              </div>
            </form>
            <div className="mt-8 text-center text-sm font-body text-on-surface-variant">
              {t('login.no_account')}{" "}
              <a className="font-medium text-primary hover:text-primary-container transition-colors" href="#">
                {t('login.request_access')}
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
