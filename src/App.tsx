import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Processos from './Processos';
import * as XLSX from 'xlsx';

export default function App() {
  const [sessao, setSessao] = useState<any>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [papel, setPapel] = useState<'gestora' | 'equipe' | null>(null);
  const [nome, setNome] = useState('');
  const [tela, setTela] = useState<'dashboard' | 'processos'>('dashboard');
  const [registros, setRegistros] = useState<any[]>([]);
  const [carregandoRegistros, setCarregandoRegistros] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregandoSessao(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessao) {
      carregarPerfil();
      carregarRegistros();
    }
  }, [sessao]);

  async function carregarPerfil() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', sessao.user.id)
      .single();

    if (data) {
      setPapel(data.papel);
      setNome(data.nome);
    }
  }

  async function carregarRegistros() {
    setCarregandoRegistros(true);
    const { data } = await supabase
      .from('registros')
      .select('*')
      .order('data_pericia', { ascending: false, nullsFirst: false });

    if (data) {
      const convertidos = data.map((r: any) => ({
        id: r.id,
        dataRecebimento: r.data_recebimento,
        processo: r.processo,
        dataPericia: r.data_pericia,
        horarioPericia: r.horario_pericia,
        statusAgendamento: r.status_agendamento,
        documentos: r.documentos,
        dataDocumentos: r.data_documentos,
        responsavel: r.responsavel,
        instalacaoUC: r.instalacao_uc,
        endereco: r.endereco,
      }));
      setRegistros(convertidos);
    }
    setCarregandoRegistros(false);
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  function exportarExcel() {
    const linhas = registros.map((r) => ({
      'DATA RECEBIMENTO': r.dataRecebimento,
      'PROCESSO': r.processo,
      'DATA PERICIA': r.dataPericia,
      'HORÁRIO': r.horarioPericia,
      'STATUS AGENDAMENTO': r.statusAgendamento,
      'DOCUMENTOS': r.documentos,
      'DATA DOCUMENTOS': r.dataDocumentos,
      'RESPONSÁVEL': r.responsavel,
      'INSTALAÇÃO/UC': r.instalacaoUC,
      'ENDEREÇO': r.endereco,
    }));
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Processos');
    XLSX.writeFile(livro, 'processos.xlsx');
  }

  if (carregandoSessao) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (!sessao) {
    return <Login />;
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const hojeStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(diaAtual).padStart(2, '0')}`;

  const registrosDoMes = registros.filter((r) => {
    if (!r.dataRecebimento) return false;
    const d = new Date(r.dataRecebimento);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalPendente = registros.filter((r) => r.statusAgendamento === 'Pendente').length;
  const totalEnviado = registros.filter((r) => r.statusAgendamento === 'Enviado').length;
  const totalDocumentosMes = registrosDoMes.filter((r) => r.documentos && r.documentos !== 'Não se aplica').length;
  const totalAgendamentosMes = registrosDoMes.length;

  const totalGeral = registros.length || 1;
  const pctPendente = Math.round((totalPendente / totalGeral) * 100);
  const pctEnviado = Math.round((totalEnviado / totalGeral) * 100);

  function contarPeriodo(pega: (data: Date) => boolean) {
    return registros.filter((r) => {
      const porAgendamento = r.dataPericia ? pega(new Date(r.dataPericia + 'T00:00:00')) : false;
      const porDocumento =
        r.documentos === 'Enviado' && r.dataDocumentos ? pega(new Date(r.dataDocumentos + 'T00:00:00')) : false;
      return porAgendamento || porDocumento;
    }).length;
  }

  const periciasHoje = contarPeriodo((d) => d.toISOString().slice(0, 10) === hojeStr);
  const periciasMes = contarPeriodo((d) => d.getMonth() === mesAtual && d.getFullYear() === anoAtual);
  const periciasAno = contarPeriodo((d) => d.getFullYear() === anoAtual);

  return (
    <div className="flex min-h-screen bg-gray-900">
      <aside className="w-56 bg-black shadow-md p-4 flex flex-col text-gray-200">
        <h2 className="font-bold text-lg mb-6 text-white">Perícia SP</h2>
        <button
          onClick={() => setTela('dashboard')}
          className={`text-left p-2 rounded mb-2 ${
            tela === 'dashboard' ? 'bg-gray-800 text-white font-medium' : 'hover:bg-gray-800'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTela('processos')}
          className={`text-left p-2 rounded mb-2 ${
            tela === 'processos' ? 'bg-gray-800 text-white font-medium' : 'hover:bg-gray-800'
          }`}
        >
          Processos
        </button>

        <div className="mt-auto">
          <p className="text-gray-400 mb-2">Olá, {nome}</p>
          <button onClick={sair} className="text-perigo text-sm underline">
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {tela === 'dashboard' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-primaria">Dashboard</h1>
              <button onClick={exportarExcel} className="bg-sucesso text-white px-4 py-2 rounded">
                Exportar Excel
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Pendente</p>
                <p className="text-2xl font-bold text-perigo">{totalPendente}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Enviado</p>
                <p className="text-2xl font-bold text-sucesso">{totalEnviado}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Documentações (mês)</p>
                <p className="text-2xl font-bold text-destaque">{totalDocumentosMes}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Agendamentos (mês)</p>
                <p className="text-2xl font-bold text-primaria">{totalAgendamentosMes}</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-200 mb-3">Status Agendamento — visão geral</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-800 border border-gray-700 rounded p-4">
                <p className="text-perigo font-semibold text-sm">PENDENTE</p>
                <p className="text-3xl font-bold text-white mt-1">{totalPendente}</p>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                  <div className="bg-perigo h-2 rounded-full" style={{ width: `${pctPendente}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pctPendente}% do total</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded p-4">
                <p className="text-sucesso font-semibold text-sm">ENVIADO</p>
                <p className="text-3xl font-bold text-white mt-1">{totalEnviado}</p>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                  <div className="bg-sucesso h-2 rounded-full" style={{ width: `${pctEnviado}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pctEnviado}% do total</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-200 mb-3">Produtividade de Perícias</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Perícias Hoje</p>
                <p className="text-2xl font-bold text-destaque">{periciasHoje}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Perícias no Mês</p>
                <p className="text-2xl font-bold text-primaria">{periciasMes}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <p className="text-sm text-gray-500">Perícias no Ano</p>
                <p className="text-2xl font-bold text-primaria">{periciasAno}</p>
              </div>
            </div>
          </div>
        )}

        {tela === 'processos' && (
          <Processos
            registros={registros}
            carregando={carregandoRegistros}
            aoAlterar={carregarRegistros}
            papel={papel}
          />
        )}
      </main>
    </div>
  );
}