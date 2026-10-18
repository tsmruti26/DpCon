import { useEffect, useState } from 'react';
import { walletApi } from '../api/client';
import { PrivacyScore } from '../components/PrivacyScore';
import { Database, Trash2 } from 'lucide-react';

export const Dashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [scoreData, setScoreData] = useState({ score: 0, risk_level: 'Loading...' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const inv = await walletApi.getInventory();
        const score = await walletApi.getScore();
        setInventory(inv.data);
        setScoreData(score.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">DpCon</h1>
          <p className="text-slate-400">Your personal data identity vault</p>
        </div>
        <div className="flex gap-4">
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            + Add Data Share
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <PrivacyScore score={scoreData.score} riskLevel={scoreData.risk_level} />
        </div>

        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="text-emerald-500" />
            <h2 className="text-xl font-semibold">My Data Inventory</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-slate-500 border-b border-slate-700 text-sm">
                <tr>
                  <th className="pb-3 font-medium">Organization</th>
                  <th className="pb-3 font-medium">Data Item</th>
                  <th className="pb-3 font-medium">Purpose</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {inventory.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">No data records found. Start adding shares!</td></tr>
                ) : (
                  inventory.map((item: any) => (
                    <tr key={item.id} className="text-sm hover:bg-slate-700/50 transition-colors">
                      <td className="py-4 font-medium">{item.organization?.name}</td>
                      <td className="py-4">{item.dataItem?.name}</td>
                      <td className="py-4 text-slate-400">{item.purpose?.description}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${item.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <button onClick={() => walletApi.withdrawConsent(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
