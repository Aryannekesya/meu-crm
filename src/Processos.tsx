import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import type { Registro } from './types';

interface Props {
  registros: Registro[];
  carregando: boolean;
  papel: 'gestora' | 'equipe';
  aoAlterar: () => void | Promise<void>;
}

const vazio: Omit<Registro, 'id'> = {
  dataRecebimento: '',
  processo: '',
  dataPericia: '',
  horarioPericia: '',
  statusAgendamento: 'Pendente',
  documentos: 'Não se aplica',
  dataDocumentos: '',
  responsavel: '',
  instalacaoUC: '',
  endereco: '',
};

function paraLinhaBanco(r: Omit<Registro, 'id'>) {
  return {
    data_recebimento: r.dataRecebimento || null,
    processo: r.processo,
    data_pericia: r.dataPericia || null,
    horario_pericia: r.horarioPericia || null,
    status_agendamento: r.statusAgendamento,
    documentos: r.documentos,
    data_documentos: r.dataDocumentos || null,
    responsavel: r.responsavel || null,
    instalacao_uc: r.instalacaoUC,
    endereco: r.endereco,
  };
}

function paraISO(valor: any): string {
	if (!valor) return "";

	if (valor instanceof Date) {
		if (isNaN(valor.getTime())) return "";
		return valor.toISOString().slice(0, 10);
	}

	if (typeof valor === "number") {
		const data = new Date(Math.round((valor - 25569) * 86400 * 1000));
		if (isNaN(data.getTime())) return "";
		return data.toISOString().slice(0, 10);
	}

	const texto = String(valor).trim();
	const partes = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
	if (partes) {
		const [, d, m, a] = partes;
		const dia = parseInt(d, 10);
		const mes = parseInt(m, 10);
		const ano = a.length === 2 ? 2000 + parseInt(a, 10) : parseInt(a, 10);

		if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";

		return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
	}

	return "";
}

function extrairHorario(dataPericiaTexto: any, horarioTexto: any): string {
  if (horarioTexto && String(horarioTexto).trim()) return String(horarioTexto).trim();
  const texto = String(dataPericiaTexto ?? '');
  const partes = texto.match(/(\d{1,2}):(\d{2})/);
  return partes ? `${partes[1].padStart(2, '0')}:${partes[2]}` : '';
}

function formatarHorario(valor: any): string {
  const texto = String(valor ?? '').trim();
  return /^\d{1,2}:\d{2}$/.test(texto) ? texto : '-';
}

function documentacaoAtrasada(r: Registro): boolean {
  if (r.documentos !== 'Pendente' || !r.dataRecebimento) return false;
  const prazo = new Date(r.dataRecebimento + 'T00:00:00');
  prazo.setDate(prazo.getDate() + 2);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje > prazo;
}

function agendamentoAtrasado(r: Registro): boolean {
  if (r.statusAgendamento !== 'Pendente' || !r.dataPericia) return false;
  const limite = new Date(r.dataPericia + 'T00:00:00');
  limite.setDate(limite.getDate() - 4);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje >= limite;
}

function normalizarStatus(valor: any): 'Enviado' | 'Pendente' {
  return String(valor ?? '').trim().toUpperCase() === 'ENVIADO' ? 'Enviado' : 'Pendente';
}

function normalizarDocumentos(valor: any): 'Não se aplica' | 'Enviado' | 'Pendente' {
  const texto = String(valor ?? '').trim().toUpperCase();
  if (texto === 'ENVIADO') return 'Enviado';
  if (texto === 'PENDENTE') return 'Pendente';
  return 'Não se aplica';
}

const inputClasse = 'bg-gray-900 border border-gray-600 rounded w-full p-2 text-gray-100';

function CampoForm({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function Processos({ registros, carregando, papel, aoAlterar }: Props) {
  const [form, setForm] = useState<Omit<Registro, 'id'>>(vazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [colaboradores, setColaboradores] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<'Agendamento' | 'Documentacao'>('Agendamento');
  const [statusFiltro, setStatusFiltro] = useState<'Todos' | 'Pendente' | 'Enviado'>('Todos');
  const [busca, setBusca] = useState('');
  const [buscaInput, setBuscaInput] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('Todos');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDataEspecifica, setFiltroDataEspecifica] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase
      .from('perfis')
      .select('nome')
      .order('nome')
      .then(({ data }) => {
        if (data) setColaboradores(data.map((p: any) => p.nome).filter(Boolean));
      });
  }, []);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (categoria === 'Agendamento') {
        if (statusFiltro !== 'Todos' && r.statusAgendamento !== statusFiltro) return false;
      } else {
        if (statusFiltro !== 'Todos' && r.documentos !== statusFiltro) return false;
      }
      if (busca && !r.processo.toLowerCase().includes(busca.trim().toLowerCase())) return false;
      if (filtroResponsavel !== 'Todos' && r.responsavel !== filtroResponsavel) return false;
      if (filtroDataEspecifica && r.dataPericia !== filtroDataEspecifica) return false;
      if (filtroDataInicio && r.dataRecebimento < filtroDataInicio) return false;
      if (filtroDataFim && r.dataRecebimento > filtroDataFim) return false;
      return true;
    });
  }, [registros, categoria, statusFiltro, busca, filtroResponsavel, filtroDataEspecifica, filtroDataInicio, filtroDataFim]);

  function atualizarCampo<K extends keyof Omit<Registro, 'id'>>(campo: K, valor: Registro[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);

    const { error } = editandoId
      ? await supabase.from('registros').update(paraLinhaBanco(form)).eq('id', editandoId)
      : await supabase.from('registros').insert(paraLinhaBanco(form));

    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setForm(vazio);
    setEditandoId(null);
    setMostrarNovo(false);
    await aoAlterar();
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm(vazio);
    setErro('');
    setMostrarNovo(true);
  }

  function cancelarNovo() {
    setMostrarNovo(false);
    setForm(vazio);
    setErro('');
  }

  function iniciarEdicao(registro: Registro) {
    setMostrarNovo(false);
    setErro('');
    setEditandoId(registro.id);
    setForm({
      dataRecebimento: registro.dataRecebimento,
      processo: registro.processo,
      dataPericia: registro.dataPericia,
      horarioPericia: registro.horarioPericia,
      statusAgendamento: registro.statusAgendamento,
      documentos: registro.documentos,
      dataDocumentos: registro.dataDocumentos,
      responsavel: registro.responsavel,
      instalacaoUC: registro.instalacaoUC,
      endereco: registro.endereco,
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(vazio);
    setErro('');
  }

  async function excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    const { error } = await supabase.from('registros').delete().eq('id', id);
    if (error) alert('Erro ao excluir: ' + error.message);
    else await aoAlterar();
  }

  function exportarExcel() {
    const dados = registrosFiltrados.map((r) => ({
      'DATA DE RECEBIMENTO': r.dataRecebimento,
      'Nº Processo': r.processo,
      'DATA DE PERÍCIA': r.dataPericia,
      HORÁRIO: formatarHorario(r.horarioPericia),
      'STATUS AGENDAMENTO': r.statusAgendamento,
      DOCUMENTOS: r.documentos,
      'DATA DOCUMENTOS': r.dataDocumentos,
      RESPONSÁVEL: r.responsavel,
      'INSTALAÇÃO/UC': r.instalacaoUC,
      ENDEREÇO: r.endereco,
    }));
    const planilha = XLSX.utils.json_to_sheet(dados);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Processos');
    XLSX.writeFile(livro, 'processos.xlsx');
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    const dadosArquivo = await arquivo.arrayBuffer();
    const livro = XLSX.read(dadosArquivo);
    const planilha = livro.Sheets[livro.SheetNames[0]];
    const linhas: any[] = XLSX.utils.sheet_to_json(planilha, { header: 1 });

    const novosRegistros = linhas
      .slice(1)
      .filter((linha) => linha && linha[1])
      .map((linha) => ({
        data_recebimento: paraISO(linha[0]) || null,
        processo: String(linha[1] ?? ''),
        data_pericia: paraISO(linha[2]) || null,
        horario_pericia: extrairHorario(linha[2], linha[3]),
        status_agendamento: normalizarStatus(linha[4]),
        documentos: normalizarDocumentos(linha[5]),
        instalacao_uc: String(linha[6] ?? ''),
        endereco: String(linha[7] ?? ''),
      }));

    const { error } = await supabase.from('registros').insert(novosRegistros);

    if (error) {
      alert('Erro ao importar: ' + error.message);
    } else {
      alert(`${novosRegistros.length} registros importados com sucesso!`);
      await aoAlterar();
    }
    e.target.value = '';
  }

  function renderCampos() {
    return (
      <>
        <CampoForm label="Data Recebimento">
          <input type="date" value={form.dataRecebimento} onChange={(e) => atualizarCampo('dataRecebimento', e.target.value)} className={inputClasse} />
        </CampoForm>
        <CampoForm label="Processo">
          <input type="text" value={form.processo} onChange={(e) => atualizarCampo('processo', e.target.value)} className={inputClasse} required />
        </CampoForm>
        <CampoForm label="Agendamento Perícia (data)">
          <input type="date" value={form.dataPericia} onChange={(e) => atualizarCampo('dataPericia', e.target.value)} className={inputClasse} />
        </CampoForm>
        <CampoForm label="Horário">
          <input type="time" value={form.horarioPericia} onChange={(e) => atualizarCampo('horarioPericia', e.target.value)} className={inputClasse} />
        </CampoForm>
        <CampoForm label="Status Agendamento">
          <select value={form.statusAgendamento} onChange={(e) => atualizarCampo('statusAgendamento', e.target.value as any)} className={inputClasse}>
            <option value="Pendente">Pendente</option>
            <option value="Enviado">Enviado</option>
          </select>
        </CampoForm>
        <CampoForm label="Documentos">
          <select value={form.documentos} onChange={(e) => atualizarCampo('documentos', e.target.value as any)} className={inputClasse}>
            <option value="Não se aplica">Não se aplica</option>
            <option value="Enviado">Enviado</option>
            <option value="Pendente">Pendente</option>
          </select>
        </CampoForm>
        <CampoForm label="Data Entrega Documentação">
          <input type="date" value={form.dataDocumentos} onChange={(e) => atualizarCampo('dataDocumentos', e.target.value)} className={inputClasse} />
        </CampoForm>
        <CampoForm label="Responsável">
          <select value={form.responsavel} onChange={(e) => atualizarCampo('responsavel', e.target.value)} className={inputClasse}>
            <option value="">Selecionar...</option>
            {colaboradores.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </CampoForm>
        <CampoForm label="Instalação/UC">
          <input type="text" value={form.instalacaoUC} onChange={(e) => atualizarCampo('instalacaoUC', e.target.value)} className={inputClasse} />
        </CampoForm>
        <CampoForm label="Endereço">
          <input type="text" value={form.endereco} onChange={(e) => atualizarCampo('endereco', e.target.value)} className={inputClasse} />
        </CampoForm>
      </>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-primaria">Processos</h1>

      {editandoId === null && (
        mostrarNovo ? (
          <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 p-4 rounded shadow mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {renderCampos()}
            {erro && <p className="text-perigo text-sm col-span-full">{erro}</p>}
            <div className="col-span-full flex gap-2">
              <button type="submit" disabled={salvando} className="bg-primaria text-white px-4 py-2 rounded disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
              <button type="button" onClick={cancelarNovo} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button onClick={abrirNovo} className="bg-primaria text-white px-4 py-2 rounded mb-6">
            + Adicionar Novo Processo
          </button>
        )
      )}

      <div className="bg-gray-800 border border-gray-700 p-3 rounded-full shadow mb-4 flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-900 rounded-full p-1 gap-1">
          <button
            type="button"
            onClick={() => { setCategoria('Agendamento'); setStatusFiltro('Todos'); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${categoria === 'Agendamento' ? 'bg-primaria text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            📅 Agendamento
          </button>
          <button
            type="button"
            onClick={() => { setCategoria('Documentacao'); setStatusFiltro('Todos'); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${categoria === 'Documentacao' ? 'bg-primaria text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            📄 Documentação
          </button>
        </div>
        <div className="flex gap-2">
          {(['Todos', 'Pendente', 'Enviado'] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                statusFiltro === s
                  ? s === 'Pendente'
                    ? 'border-perigo text-perigo bg-perigo/10'
                    : s === 'Enviado'
                    ? 'border-sucesso text-sucesso bg-sucesso/10'
                    : 'border-destaque text-destaque bg-destaque/10'
                  : 'border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 p-4 rounded shadow mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Buscar processo</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nº do processo..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setBusca(buscaInput); }}
              className={inputClasse}
            />
            <button type="button" onClick={() => setBusca(buscaInput)} className="bg-primaria text-white px-4 py-2 rounded whitespace-nowrap">
              Buscar
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Responsável</label>
          <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className={inputClasse}>
            <option value="Todos">Todos</option>
            {colaboradores.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Data específica (perícia)</label>
          <input type="date" value={filtroDataEspecifica} onChange={(e) => setFiltroDataEspecifica(e.target.value)} className={inputClasse} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">De</label>
          <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className={inputClasse} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Até</label>
          <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className={inputClasse} />
        </div>
        <button onClick={exportarExcel} className="bg-sucesso text-white px-4 py-2 rounded">
          Exportar para Excel
        </button>
        {papel === 'gestora' && (
          <label className="bg-destaque text-white px-4 py-2 rounded cursor-pointer">
            Importar Excel
            <input type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
          </label>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded shadow overflow-x-auto">
        {carregando ? (
          <p className="p-4 text-gray-400">Carregando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-300">
              <tr>
                <th className="p-2 text-left border-r border-gray-700">Data Recebimento</th>
                <th className="p-2 text-left border-r border-gray-700">Processo</th>
                <th className="p-2 text-left border-r border-gray-700">Data Perícia</th>
                <th className="p-2 text-left border-r border-gray-700">Horário</th>
                <th className="p-2 text-left border-r border-gray-700">Status Agendamento</th>
                <th className="p-2 text-left border-r border-gray-700">Documentos</th>
                <th className="p-2 text-left border-r border-gray-700">Responsável</th>
                <th className="p-2 text-left border-r border-gray-700">Instalação/UC</th>
                <th className="p-2 text-left border-r border-gray-700">Endereço</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r) =>
                editandoId === r.id ? (
                  <tr key={r.id} className="border-t border-gray-700 bg-gray-700">
                    <td colSpan={10} className="p-4">
                      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {renderCampos()}
                        {erro && <p className="text-perigo text-sm col-span-full">{erro}</p>}
                        <div className="col-span-full flex gap-2">
                          <button type="submit" disabled={salvando} className="bg-primaria text-white px-4 py-2 rounded disabled:opacity-50">
                            {salvando ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button type="button" onClick={cancelarEdicao} className="bg-gray-600 text-white px-4 py-2 rounded">
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={r.id}
                    onClick={() => iniciarEdicao(r)}
                    className={`border-t border-gray-700 hover:bg-gray-700 cursor-pointer ${
                      documentacaoAtrasada(r) || agendamentoAtrasado(r) ? 'bg-perigo/20 text-red-200' : 'text-gray-200'
                    }`}
                  >
                    <td className="p-2 border-r border-gray-700">{r.dataRecebimento}</td>
                    <td className="p-2 border-r border-gray-700 font-medium">{r.processo}</td>
                    <td className="p-2 border-r border-gray-700">{r.dataPericia}</td>
                    <td className="p-2 border-r border-gray-700">{formatarHorario(r.horarioPericia)}</td>
                    <td className="p-2 border-r border-gray-700">{r.statusAgendamento}</td>
                    <td className="p-2 border-r border-gray-700">{r.documentos}</td>
                    <td className="p-2 border-r border-gray-700">{r.responsavel}</td>
                    <td className="p-2 border-r border-gray-700">{r.instalacaoUC}</td>
                    <td className="p-2 border-r border-gray-700">{r.endereco}</td>
                    <td className="p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); excluir(r.id); }}
                        title="Excluir"
                        className="text-perigo hover:text-red-400"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a2 2 0 002 2h4a2 2 0 002-2V7m-8 0h8" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
