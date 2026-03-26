// src/components/ProductWiseTable.jsx
import React from 'react';

const productData = [
  {
    product: 'Product',
    totalCampaigns: 1,
    budgetGroups: 55,
    bookedRevenue: '$0.48M',
    spend: '$166.74K',
    plannedImpressions: '22.37M',
    deliveredImpressions: '19.38M (86.67%)',
    grossProfitLoss: '$0.31M',
    grossMargin: '64.92%',
  },
  {
    product: 'Crafters',
    totalCampaigns: 1,
    budgetGroups: 8,
    bookedRevenue: '$0.04M',
    spend: '$19.26K',
    plannedImpressions: '13.68M',
    deliveredImpressions: '13.39M (97.86%)',
    grossProfitLoss: '$0.02M',
    grossMargin: '45.98%',
  },
  {
    product: 'Mirrors',
    totalCampaigns: 294,
    budgetGroups: 1956,
    bookedRevenue: '$16.31M',
    spend: '$6.95M',
    plannedImpressions: '3,288.62M',
    deliveredImpressions: '2,666.61M (81.09%)',
    grossProfitLoss: '$9.36M',
    grossMargin: '57.38%',
  },
  // ... add the rest: Open, Others, Parallels, Self serve, TIKTOK, Zimmer
  {
    product: 'Zimmer',
    totalCampaigns: 1,
    budgetGroups: 1,
    bookedRevenue: '$0.00M',
    spend: '$159.00',
    plannedImpressions: '0.01M',
    deliveredImpressions: '9.35K (99.63%)',
    grossProfitLoss: '$0.00M',
    grossMargin: '80.74%',
  },
  // Total row (can be styled differently)
  {
    isTotal: true,
    product: 'Total',
    totalCampaigns: 315,
    budgetGroups: 2252,
    bookedRevenue: '$18.68M',
    spend: '$7.70M',
    plannedImpressions: '4,114.68M',
    deliveredImpressions: '3,434.93M (83.48%)',
    grossProfitLoss: '$10.98M',
    grossMargin: '58.77%',
  },
];

const ProductWiseTable = () => {
  return (
    <div className="overflow-x-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Product wise data</h2>
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Product</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Campaigns</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Budget Groups</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Booked Revenue</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Spend</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Planned Impressions</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Delivered Impressions</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gross Profit / Loss</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gross Margin</th>
          </tr>
        </thead>
        <tbody>
          {productData.map((row, idx) => (
            <tr
              key={idx}
              className={`border-t ${row.isTotal ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'}`}
            >
              <td className="px-4 py-3 text-sm text-gray-900">{row.product}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.totalCampaigns}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.budgetGroups}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.bookedRevenue}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.spend}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.plannedImpressions}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.deliveredImpressions}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.grossProfitLoss}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.grossMargin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductWiseTable;