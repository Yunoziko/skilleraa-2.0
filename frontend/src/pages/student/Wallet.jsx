import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { ListRowSkeleton, StatSkeletonGrid } from "@/components/Skeleton";
import { Clock, IndianRupee, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { fetchMyWallet, formatINR } from "@/lib/paymentsService";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyWallet()
      .then(({ wallet: w, transactions: tx }) => {
        if (!active) return;
        setWallet(w);
        setTransactions(tx);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(e?.message || "Failed to load wallet");
        setWallet({
          available_balance: 0,
          pending_balance: 0,
          lifetime_earnings: 0,
        });
        setTransactions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell title="Wallet">
      {loading ? (
        <StatSkeletonGrid count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Clock}
            label="Pending Earnings"
            value={formatINR(wallet?.pending_balance)}
            testId="wallet-pending"
          />
          <StatCard
            icon={IndianRupee}
            label="Available Balance"
            value={formatINR(wallet?.available_balance)}
            testId="wallet-available"
          />
          <StatCard
            icon={TrendingUp}
            label="Lifetime Earnings"
            value={formatINR(wallet?.lifetime_earnings)}
            testId="wallet-lifetime"
          />
        </div>
      )}

      <div className="mt-8 border skl-border rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Recent transactions</h2>
          <WalletIcon size={16} className="text-neutral-400" aria-hidden />
        </div>
        <div className="mt-4">
          {loading ? (
            <ListRowSkeleton count={3} />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="No earnings yet"
              description="When a client pays for an accepted application, credits appear here."
              icon={WalletIcon}
              compact
            />
          ) : (
            <div className="divide-y divide-neutral-200 border skl-border rounded-xl overflow-hidden">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-4 bg-white"
                  data-testid={`wallet-tx-${t.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.description || t.type}</div>
                    <div className="text-xs text-neutral-500">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                      {" · "}
                      <span className="uppercase tracking-widest">{t.type}</span>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-medium shrink-0 ${
                      t.type === "credit" ? "text-black" : "text-neutral-500"
                    }`}
                  >
                    {t.type === "credit" ? "+" : "-"}
                    {formatINR(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Withdrawals are not available yet. Paid amounts are held as pending earnings.
        </p>
      </div>
    </DashboardShell>
  );
}
