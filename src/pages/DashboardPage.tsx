import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "../components/Navbar";

interface Contact {
  id: number;
  nome: string;
}

interface Order {
  id: number;
  stato: string;
  totale: number | null;
  data_ordine: string | null;
}

export default function DashboardPage() {
  const token = localStorage.getItem("token");

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const response = await fetch("/api/my/v1/contacts", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.contacts;
    },
    enabled: !!token,
  });

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await fetch("/api/my/v1/orders", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.orders;
    },
    enabled: !!token,
  });

  const totalContacts = contacts?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, order) => sum + (order.totale || 0), 0) || 0;
  
  const pendingOrders = orders?.filter(o => o.stato === "pending").length || 0;
  const shippedOrders = orders?.filter(o => o.stato === "shipped").length || 0;
  const deliveredOrders = orders?.filter(o => o.stato === "delivered").length || 0;

  const recentOrders = orders?.slice(0, 5) || [];

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Devi essere autenticato per visualizzare la dashboard.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Link to="/contacts">
              <Button variant="outline">Gestisci Contatti</Button>
            </Link>
            <Link to="/orders">
              <Button>Gestisci Ordini</Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Totale Contatti</CardDescription>
              <CardTitle className="text-4xl">{loadingContacts ? "-" : totalContacts}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/contacts" className="text-sm text-primary hover:underline">
                Vedi tutti →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Totale Ordini</CardDescription>
              <CardTitle className="text-4xl">{loadingOrders ? "-" : totalOrders}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/orders" className="text-sm text-primary hover:underline">
                Vedi tutti →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Fatturato Totale</CardDescription>
              <CardTitle className="text-4xl">
                {loadingOrders ? "-" : `€ ${totalRevenue.toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Da tutti gli ordini</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ordini in Attesa</CardDescription>
              <CardTitle className="text-4xl">{loadingOrders ? "-" : pendingOrders}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Da processare</p>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Breakdown */}
        {orders && orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Riepilogo Ordini per Stato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700">{pendingOrders}</p>
                  <p className="text-sm text-yellow-600">In Attesa</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{shippedOrders}</p>
                  <p className="text-sm text-blue-600">Spediti</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{deliveredOrders}</p>
                  <p className="text-sm text-green-600">Consegnati</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-700">
                    {orders.filter(o => o.stato === "cancelled").length}
                  </p>
                  <p className="text-sm text-gray-600">Annullati</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Ultimi Ordini</CardTitle>
            <CardDescription>I 5 ordini più recenti</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <p>Caricamento...</p>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nessun ordine trovato</p>
                <Link to="/orders">
                  <Button>Crea il tuo primo ordine</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order: Order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-semibold">
                        #{order.id}
                      </div>
                      <div>
                        <p className="font-medium">Ordine #{order.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.data_ordine 
                            ? new Date(order.data_ordine).toLocaleDateString("it-IT")
                            : "Data non specificata"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.stato === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : order.stato === "shipped"
                            ? "bg-blue-100 text-blue-800"
                            : order.stato === "delivered"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {order.stato}
                      </span>
                      <p className="font-semibold">
                        {order.totale !== null ? `€ ${order.totale.toFixed(2)}` : "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Azioni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Link to="/contacts">
                <Button variant="outline">
                  + Nuovo Contatto
                </Button>
              </Link>
              <Link to="/orders">
                <Button>
                  + Nuovo Ordine
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
