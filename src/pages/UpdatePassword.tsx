import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { InputField } from "../components/InputField";

export const UpdatePassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we actually have a hash with access_token or an active session for recovery
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If there's no session, we might not have a valid recovery token
        setError("Sessão inválida ou link expirado. Tente solicitar a recuperação novamente.");
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Senha atualizada com sucesso!");
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_40px_rgba(11,28,48,0.06)] border border-outline-variant/10">
        <div className="mb-8 text-center">
          <h1 className="font-headline font-bold text-3xl text-on-background mb-2">
            Nova Senha
          </h1>
          <p className="font-body text-on-surface-variant">
            Crie uma nova senha para sua conta.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-primary/10 text-primary rounded-lg text-sm font-medium flex items-center gap-2 border border-primary/20">
            <span className="material-symbols-outlined">check_circle</span>
            {message}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          <InputField 
            label="Nova Senha"
            type="password"
            icon="lock"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button className="w-full py-4 text-base font-bold shadow-lg shadow-primary/20" type="submit" disabled={loading || !!message}>
            {loading ? "Atualizando..." : "Atualizar Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
};
