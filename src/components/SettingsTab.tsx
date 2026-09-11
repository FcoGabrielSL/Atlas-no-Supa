import React from "react";
import { Info, Check, Copy } from "lucide-react";

interface SettingsTabProps {
  copyAppsScriptCode: () => void;
  copiedScript: boolean;
  appsScriptTemplateCode: string;
  handleClearLocals: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  copyAppsScriptCode,
  copiedScript,
  appsScriptTemplateCode,
  handleClearLocals,
}) => {
  return (
    <div id="developer-settings" className="p-6 md:p-8 space-y-6 text-slate-300">
      <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 max-w-3xl font-sans">
        <Info className="w-5.5 h-5.5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">
            Como funciona esta integração?
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            A aplicação utiliza o <strong>Google Apps Script</strong>{" "}
            como uma ponte de API de baixíssima latência. Os dados da
            planilha são servidos como endpoints JSON e as inserções
            via sistema executam em background diretamente no seu
            documento das planilhas Google.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-950 p-4 border border-slate-800 rounded-xl font-sans">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 block uppercase">
              Código de Implantação Ativo
            </span>
            <span className="text-[11px] font-mono select-all text-purple-400 break-all bg-slate-900 px-2 py-1 rounded border border-slate-800">
              AKfycbxG9mOMXiO2mrtBZWh6Nk9skS8wFiLSIueXa5ldCweZxhgT2C1fDMR3qATs7DQxsIWr
            </span>
          </div>
        </div>

        <div className="space-y-2 font-sans">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">
              Código do Apps Script para Google Sheets
            </h4>
            <button
              onClick={copyAppsScriptCode}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              {copiedScript ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Código
                </>
              )}
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-805 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-[350px] leading-relaxed select-all">
            {appsScriptTemplateCode}
          </pre>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs font-sans">
          <span className="text-slate-500">
            Pressione para redefinir as tabelas e dados locais
            temporários:
          </span>
          <button
            onClick={handleClearLocals}
            className="px-3 py-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 transition cursor-pointer"
          >
            Limpar Inseridos Locais
          </button>
        </div>
      </div>
    </div>
  );
};
