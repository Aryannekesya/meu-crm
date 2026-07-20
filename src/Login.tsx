import { useState, type FormEvent } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) setErro(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } },
      });
      if (error) {
        setErro(error.message);
      } else {
        setMensagem('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
      }
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
          {modo === 'entrar' ? 'Entrar no CRM' : 'Criar conta'}
        </h1>

        {modo === 'cadastro' && (
          <input
            type="text"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="border rounded w-full p-2 mb-3"
            required
          />
        )}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded w-full p-2 mb-3"
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="border rounded w-full p-2 mb-3"
          required
          minLength={6}
        />

        {erro && <p className="text-red-600 text-sm mb-2">{erro}</p>}
        {mensagem && <p className="text-green-600 text-sm mb-2">{mensagem}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="bg-blue-600 text-white rounded w-full p-2 font-medium disabled:opacity-50"
        >
          {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Cadastrar'}
        </button>

        <p className="text-sm text-center mt-4">
          {modo === 'entrar' ? (
            <>
              Ainda não tem conta?{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => setModo('cadastro')}
              >
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => setModo('entrar')}
              >
                Entrar
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}