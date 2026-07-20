export interface Registro {
  id: string;
  dataRecebimento: string;
  processo: string;
  dataPericia: string;
  horarioPericia: string;
  statusAgendamento: 'Enviado' | 'Pendente';
  documentos: 'Não se aplica' | 'Enviado' | 'Pendente';
  dataDocumentos: string;
  responsavel: string;
  instalacaoUC: string;
  endereco: string;
}