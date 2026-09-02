import { useState, type FormEvent } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      setErro(error.message);
    } else {
      setMensagem('Link de acesso enviado! Verifique seu e-mail para entrar no CRM.');
    }

    setCarregando(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-full max-w-sm"
      >
        <h1 className="text-xl font-bold mb-4 text-center">
          Entrar no CRM
        </h1>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded w-full p-2 mb-3"
          required
        />

        {erro && <p className="text-red-600 text-sm mb-2">{erro}</p>}
        {mensagem && <p className="text-green-600 text-sm mb-2">{mensagem}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="bg-blue-600 text-white rounded w-full p-2 font-medium disabled:opacity-50"
        >
          {carregando ? 'Enviando...' : 'Enviar link de acesso'}
        </button>

        <p className="text-sm text-center mt-4 text-gray-500">
          Você vai receber um link por e-mail para entrar. Só quem já tem acesso liberado recebe o link.
        </p>
      </form>
    </div>
  );
}
