import React from "react";
import { Trash2 } from "lucide-react";
import { UserConfig, AtenuacoesRow } from "../types";

interface AtenuacoesTabProps {
  filteredAtenuacoes: AtenuacoesRow[];
  currentUser: UserConfig;
  setSelectedItem: (item: any) => void;
  setSelectedItemType: (type: string) => void;
  setShowInsertModal: (tab: any) => void;
  setDeleteConfirmation: (conf: { id: string; type: string }) => void;
}

export const AtenuacoesTab: React.FC<AtenuacoesTabProps> = ({
  filteredAtenuacoes,
  currentUser,
  setSelectedItem,
  setSelectedItemType,
  setShowInsertModal,
  setDeleteConfirmation,
}) => {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white">Controle de Atenuações Técnicas (Planilha ATENUAÇÕES)</h2>
          <p className="text-xs text-slate-400 font-sans">Acompanhamento de degradação física de sinal e controle de perdas cumulativas por trecho óptico.</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
            <tr>
              <th className="p-4">IMOC / Status</th>
              <th className="p-4">SLA / Gravidade</th>
              <th className="p-4">Rede</th>
              <th className="p-4">Trecho Óptico</th>
              <th className="p-4">Perdas (dB)</th>
              <th className="p-4">Abertura</th>
              <th className="p-4">Detalhamento Técnico / Diagnóstico</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredAtenuacoes.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 font-medium font-sans">
                  Nenhuma atenuação encontrada com os filtros especificados.
                </td>
              </tr>
            ) : (
              filteredAtenuacoes.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/20 transition">
                  <td className="p-4 font-mono">
                    <div className="font-semibold text-white">#{item["Id Imoc"] || item.id}</div>
                    <div className="mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        String(item.Status).toUpperCase() === "ABERTO" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                        String(item.Status).toUpperCase() === "FECHADO" || String(item.Status).toUpperCase() === "CONCLUÍDO" || String(item.Status).toUpperCase() === "CONCLUIDO" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {item.Status || "ABERTO"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      String(item.Sla).toLowerCase().includes("crit") ? "bg-rose-500/10 text-rose-450 border-rose-500/20" :
                      String(item.Sla).toLowerCase().includes("med") || String(item.Sla).toLowerCase().includes("méd") ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-teal-500/10 text-teal-400 border-teal-500/20"
                    }`}>
                      {item.Sla || "Médio"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 font-semibold font-mono">{item.Rede || "-"}</td>
                  <td className="p-4 text-white font-semibold font-mono">{item.Trecho || "-"}</td>
                  <td className="p-4 text-rose-400 font-black font-mono text-xs">
                    {item.Percas ? `${item.Percas} dB` : "-"}
                  </td>
                  <td className="p-4 text-slate-450 font-mono text-[11px]">{item["Data de abertura"] || "-"}</td>
                  <td className="p-4 max-w-sm font-sans text-[11px] leading-relaxed">
                    <div className="text-slate-300 whitespace-pre-wrap break-words">{item.Detalhamento || "-"}</div>
                    {item.Pioras && (
                      <div className="text-[10px] mt-1 text-rose-450 bg-rose-950/20 px-2 py-1 rounded border border-rose-950">
                        ⚠️ Pioras: {item.Pioras}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {currentUser.permissions.atenuacoes?.editar && (
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setSelectedItemType("atenuacoes");
                            setShowInsertModal("atenuacoes");
                          }}
                          className="p-1 px-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                      {currentUser.permissions.atenuacoes?.excluir && (
                        <button
                          onClick={() => {
                            setDeleteConfirmation({ id: item.id, type: "atenuacoes" });
                          }}
                          className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-rose-500 border border-slate-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
