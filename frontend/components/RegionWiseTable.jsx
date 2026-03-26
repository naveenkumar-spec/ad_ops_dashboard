// src/components/RegionWiseTable.jsx
import React from 'react';

const regionData = [
  {
    region: 'India+SEA',
    totalCampaigns: 153,
    budgetGroups: 1216,
    bookedRevenue: 'USD 7.33M',
    spend: 'USD 2.51M',
    plannedImpressions: '2.59B',
    deliveredImpressions: '2.22B (85.91%)',
    grossMargin: 'USD 4.81M',
    grossMarginPercent: '65.70%',
  },
  // ... add the rest: North America, Australia, Europe, Middle East, Rest of APAC, Japan, Africa
  {
    region: 'Africa',
    totalCampaigns: 13,
    budgetGroups: 72,
    bookedRevenue: 'USD 210.53K',
    spend: 'USD 91.43K',
    plannedImpressions: '30.50M',
    deliveredImpressions: '17.05M (55.90%)',
    grossMargin: 'USD 105.35K',
    grossMarginPercent: '50.04%',
  },
  {
    isTotal: true,
    region: 'Total',
    totalCampaigns: 417,
    budgetGroups: 2643,
    bookedRevenue: 'USD 21.14M',
    spend: 'USD 8.72M',
    plannedImpressions: '4.77B',
    deliveredImpressions: '3.73B (78.27%)',
    grossMargin: 'USD 12.42M',
    grossMarginPercent: '58.74%',
  },
];

const RegionWiseTable = () => {
  return (
    <div className="overflow-x-auto mt-12">
      <h2 className="text-xl font-bold mb-4">Region / Country wise Data</h2>
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Region & Country</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Campaigns</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Budget Groups</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Booked Revenue</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Spend</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Planned Impressions</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Delivered Impressions</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gross Margin</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gross Margin %</th>
          </tr>
        </thead>
        <tbody>
          {regionData.map((row, idx) => (
            <tr
              key={idx}
              className={`border-t ${row.isTotal ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'}`}
            >
              <td className="px-4 py-3 text-sm text-gray-900">{row.region}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.totalCampaigns}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.budgetGroups}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.bookedRevenue}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.spend}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.plannedImpressions}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.deliveredImpressions}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.grossMargin}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-900">{row.grossMarginPercent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RegionWiseTable;