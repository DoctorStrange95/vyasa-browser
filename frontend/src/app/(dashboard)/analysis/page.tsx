export default function AnalysisPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Data Analysis</h2>
        <a
          href="/analysis/new"
          className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
        >
          Upload Dataset
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Descriptive Stats', icon: '📊', desc: 'Mean, median, SD, frequencies' },
          { title: 'Chi-Square Test', icon: '✓', desc: 'Categorical associations' },
          { title: 'T-Test', icon: '≠', desc: 'Compare means between groups' },
          { title: 'ANOVA', icon: '∑', desc: 'Multiple group comparisons' },
          { title: 'Regression', icon: '📈', desc: 'Linear & logistic models' },
          { title: 'Epidemiology', icon: '🔬', desc: 'Rates, ratios, forest plots' },
        ].map((analysis) => (
          <div
            key={analysis.title}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-3xl mb-2">{analysis.icon}</div>
            <h3 className="font-bold text-slate-900">{analysis.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{analysis.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
