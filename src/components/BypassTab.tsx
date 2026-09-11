import React from "react";
import { Trash2 } from "lucide-react";
import { UserConfig } from "../types";

interface BypassTabProps {
  filteredBypass: any[];
  currentUser: UserConfig;
  setSelectedItem: (item: any) => void;
  setSelectedItemType: (type: string) => void;
  setShowInsertModal: (tab: any) => void;
  setDeleteConfirmation: (conf: { id: string; type: string }) => void;
}

export const BypassTab: React.FC<BypassTabProps> = ({
  filteredBypass,
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
          <h2 className="text-lg font-bold text-white">Atuações Bypass</h2>
          <p className="text-xs text-slate-400 font-sans">Controle e registre as pontes e desvios críticos ativos temporariamente no backbone de fibra.</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
            <tr>
              <th className="p-4">Dispositivo / Trecho Afetado</th>
              <th className="p-4">Motivo do Bypass</th>
              <th className="p-4">Responsável</th>
              <th className="p-4">Data Ativação</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredBypass.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium font-sans">
                  Nenhum bypass configurado no momento.
                </td>
              </tr>
            ) : (
              filteredBypass.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/30 transition">
                  <td className="p-4 font-semibold text-white font-mono">{item["DISPOSITIVO/TRECHO"]}</td>
                  <td className="p-4 text-slate-300 font-sans">{item["MOTIVO BYPASS"]}</td>
                  <td className="p-4 text-slate-300 font-medium font-sans">{item["RESPONSÁVEL "]}</td>
                  <td className="p-4 text-slate-400 font-mono">{item["DATA ATIVAÇÃO"]}</td>
                  <td className="p-4 text-sans">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item["STATUS"] === "Ativo" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" : "bg-slate-800 text-slate-450"
                    }`}>
                      {item["STATUS"]}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1.5 font-sans">
                      {currentUser.permissions.bypass?.editar && (
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setSelectedItemType("bypass");
                            setShowInsertModal("bypass");
                          }}
                          className="p-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-mono text-[10px] cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                      {currentUser.permissions.bypass?.excluir && (
                        <button
                          onClick={() => {
                            setDeleteConfirmation({ id: item.id, type: "bypass" });
                          }}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-rose-500 border border-slate-800 cursor-pointer"
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
