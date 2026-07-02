import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "../components/Navbar";

interface Scadenza {
  id: number;
  cliente_nome: string;
  data_ordine: string | null;
  stato_ordine: string;
  totale: number | null;
  totale_pagato: number;
  stato_pagamento: "da_pagare" | "parzialmente_pagata" | "pagata";
  residuo: number;
  is_scaduta: boolean;
  is_prossima_scadenza: boolean;
}

export default function ScadenzePage() {
  const queryClient = useQueryClient();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const { data: scadenze, isLoading } = useQuery({
    queryKey: ["scadenze", userId],
    queryFn: async () => {
      const response = await fetch(`/api/my/v1/scadenze`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.scadenze;
    },
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare le scadenze.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Scadenze</h1>
        </div>

        {isLoading ? (
          <p>Caricamento...</p>
        ) : scadenze?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessuna fattura in scaduta o da pagare.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scadenze?.map((scadenza: Scadenza) => (
              <Card key={scadenza.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Fattura #{scadenza.id}</CardTitle>
                      <CardDescription>
                        {scadenza.cliente_nome || "Cliente non specificato"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {scadenza.is_scaduta && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white">
                          SCADUTA
                        </span>
                      )}
                      {scadenza.is_prossima_scadenza && !scadenza.is_scaduta && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500 text-white">
                          Scade tra 7 giorni
                        </span>
                      )}
                      <span 
                        className={`px-2 py-1 rounded text-xs font-medium border ${
                          scadenza.stato_pagamento === "da_pagare" ? "border-red-500 text-red-600" :
                          scadenza.stato_pagamento === "parzialmente_pagata" ? "border-yellow-500 text-yellow-600" :
                          "border-green-500 text-green-600"
                        }`}
                      >
                        {scadenza.stato_pagamento === "da_pagare" ? "Da pagare" :
                         scadenza.stato_pagamento === "parzialmente_pagata" ? "Parzialmente pagata" :
                         "Pagata"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Data fattura:</span>
                    <span>{scadenza.data_ordine ? new Date(scadenza.data_ordine).toLocaleDateString("it-IT") : "-"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Totale fattura:</span>
                    <span className="font-semibold">€ {scadenza.totale?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Totale pagato:</span>
                    <span className="text-green-600 font-semibold">€ {scadenza.totale_pagato.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="font-medium">Da pagare:</span>
                    <span className={`font-bold ${scadenza.residuo > 0 ? "text-red-600" : "text-green-600"}`}>
                      € {scadenza.residuo.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ""}`,
  };
}
