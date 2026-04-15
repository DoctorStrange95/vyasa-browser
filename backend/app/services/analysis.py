"""
Statistical analysis engine.

Supported analysis types
------------------------
descriptive        — mean, median, SD, IQR, min, max, frequency tables
chi_square         — χ² test (categorical × categorical)
t_test             — independent t-test or Mann-Whitney U fallback
anova              — one-way ANOVA or Kruskal-Wallis fallback
correlation        — Pearson or Spearman
linear_regression  — simple / multiple OLS
logistic_regression— binary logistic regression + OR with 95 % CI
odds_ratio         — 2×2 table OR
risk_ratio         — 2×2 table RR
attack_rate        — cases / at-risk population
incidence          — new cases / person-time
prevalence         — cases / total population
cfr                — case-fatality rate
standardized_rate  — age/sex direct standardization
forest_plot        — forest plot data builder from pre-computed estimates

Every function returns the unified result dict:
{
  "result_table": list[dict] | dict,
  "interpretation_text": str,
  "chart_data": dict (Vega-Lite spec) | None,
  "p_value": float | None,
  "conclusion": str,
  "warnings": list[str],
}
"""
from __future__ import annotations

import math
from typing import Any, Optional

import numpy as np
import pandas as pd
import scipy.stats as stats
import statsmodels.api as sm
from statsmodels.stats.contingency_tables import Table2x2

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALPHA = 0.05


def _fmt(val: Any, decimals: int = 4) -> Any:
    if val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return round(val, decimals)
    return val


def _significance(p: Optional[float]) -> str:
    if p is None:
        return "N/A"
    if p < 0.001:
        return "p < 0.001 (highly significant)"
    if p < 0.01:
        return f"p = {p:.4f} (significant)"
    if p < 0.05:
        return f"p = {p:.4f} (significant)"
    return f"p = {p:.4f} (not significant at α = 0.05)"


def _result(
    result_table: Any,
    interpretation: str,
    chart_data: Optional[dict],
    p_value: Optional[float],
    conclusion: str,
    warnings: Optional[list[str]] = None,
) -> dict:
    return {
        "result_table": result_table,
        "interpretation_text": interpretation,
        "chart_data": chart_data,
        "p_value": _fmt(p_value),
        "conclusion": conclusion,
        "warnings": warnings or [],
    }


def _check_normality(series: pd.Series) -> bool:
    """Shapiro-Wilk; returns True if normal (p > 0.05). Uses K-S for n > 5000."""
    data = series.dropna()
    n = len(data)
    if n < 3:
        return False
    if n <= 5000:
        _, p = stats.shapiro(data)
    else:
        _, p = stats.kstest(data, "norm", args=(data.mean(), data.std()))
    return p > 0.05


def _vl_bar(x_data: list, y_data: list, x_title: str, y_title: str) -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "bar",
        "data": {"values": [{"x": x, "y": y} for x, y in zip(x_data, y_data)]},
        "encoding": {
            "x": {"field": "x", "type": "nominal", "title": x_title},
            "y": {"field": "y", "type": "quantitative", "title": y_title},
        },
    }


def _vl_scatter(df: pd.DataFrame, x_col: str, y_col: str) -> dict:
    values = [{"x": row[x_col], "y": row[y_col]} for _, row in df[[x_col, y_col]].dropna().iterrows()]
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "point",
        "data": {"values": values[:500]},  # cap for JSON size
        "encoding": {
            "x": {"field": "x", "type": "quantitative", "title": x_col},
            "y": {"field": "y", "type": "quantitative", "title": y_col},
        },
    }


def _vl_boxplot(df: pd.DataFrame, group_col: str, value_col: str) -> dict:
    values = [{"group": str(row[group_col]), "value": row[value_col]}
              for _, row in df[[group_col, value_col]].dropna().iterrows()]
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": {"type": "boxplot", "extent": "min-max"},
        "data": {"values": values[:2000]},
        "encoding": {
            "x": {"field": "group", "type": "nominal", "title": group_col},
            "y": {"field": "value", "type": "quantitative", "title": value_col},
        },
    }


# ---------------------------------------------------------------------------
# 1. DESCRIPTIVE STATISTICS
# ---------------------------------------------------------------------------

def run_descriptive(df: pd.DataFrame, columns: list[str]) -> dict:
    rows = []
    charts = []

    for col in columns:
        if col not in df.columns:
            continue
        series = df[col].dropna()

        if pd.api.types.is_numeric_dtype(series):
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            row = {
                "variable": col,
                "n": len(series),
                "missing": int(df[col].isna().sum()),
                "mean": _fmt(series.mean()),
                "median": _fmt(series.median()),
                "sd": _fmt(series.std()),
                "iqr": _fmt(q3 - q1),
                "min": _fmt(series.min()),
                "max": _fmt(series.max()),
                "skewness": _fmt(series.skew()),
                "kurtosis": _fmt(series.kurtosis()),
            }
            charts.append({
                "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
                "mark": "bar",
                "title": f"Distribution of {col}",
                "data": {"values": [{"value": v} for v in series.tolist()[:5000]]},
                "encoding": {
                    "x": {"bin": {"maxbins": 20}, "field": "value", "type": "quantitative", "title": col},
                    "y": {"aggregate": "count", "type": "quantitative", "title": "Count"},
                },
            })
        else:
            freq = series.value_counts()
            pct = series.value_counts(normalize=True) * 100
            row = {
                "variable": col,
                "n": len(series),
                "missing": int(df[col].isna().sum()),
                "type": "categorical",
                "categories": [
                    {"value": str(v), "count": int(freq[v]), "percent": _fmt(pct[v])}
                    for v in freq.index[:20]
                ],
            }
            charts.append(_vl_bar(
                [str(v) for v in freq.index[:10]],
                [int(c) for c in freq.values[:10]],
                col, "Count"
            ))
        rows.append(row)

    interp = (
        f"Descriptive statistics computed for {len(columns)} variable(s). "
        "Numeric variables are summarized with mean, median, SD, IQR, min, max, "
        "skewness, and kurtosis. Categorical variables show frequency distributions."
    )
    return _result(rows, interp, charts[0] if len(charts) == 1 else None, None,
                   "Descriptive statistics completed successfully.")


# ---------------------------------------------------------------------------
# 2. CHI-SQUARE TEST
# ---------------------------------------------------------------------------

def run_chi_square(df: pd.DataFrame, row_var: str, col_var: str) -> dict:
    warnings: list[str] = []
    ct = pd.crosstab(df[row_var], df[col_var])
    chi2, p, dof, expected = stats.chi2_contingency(ct)

    # Check expected cell count assumption
    if (expected < 5).any():
        warnings.append(
            "Some expected cell counts < 5. Consider Fisher's exact test or combining categories."
        )
        # Fall back to Fisher for 2×2
        if ct.shape == (2, 2):
            _, p_fisher = stats.fisher_exact(ct)
            p = p_fisher
            warnings.append(f"Fisher's exact test p-value used: {_fmt(p_fisher)}")

    n = ct.values.sum()
    cramers_v = math.sqrt(chi2 / (n * (min(ct.shape) - 1))) if min(ct.shape) > 1 else None

    result_table = {
        "contingency_table": ct.to_dict(),
        "chi2": _fmt(chi2),
        "df": dof,
        "p_value": _fmt(p),
        "cramers_v": _fmt(cramers_v),
        "n": int(n),
    }

    sig = _significance(p)
    effect = f" Cramér's V = {_fmt(cramers_v)} (effect size)." if cramers_v is not None else ""
    interp = (
        f"Chi-square test of independence between '{row_var}' and '{col_var}': "
        f"χ²({dof}, N={n}) = {_fmt(chi2)}, {sig}.{effect}"
    )
    conclusion = (
        f"There {'is' if p < _ALPHA else 'is no'} statistically significant association "
        f"between {row_var} and {col_var} (p {'<' if p < _ALPHA else '≥'} 0.05)."
    )

    # Heatmap chart
    chart = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "rect",
        "data": {"values": [
            {"row": str(r), "col": str(c), "count": int(ct.loc[r, c])}
            for r in ct.index for c in ct.columns
        ]},
        "encoding": {
            "x": {"field": "col", "type": "nominal", "title": col_var},
            "y": {"field": "row", "type": "nominal", "title": row_var},
            "color": {"field": "count", "type": "quantitative", "title": "Count"},
        },
    }

    return _result(result_table, interp, chart, p, conclusion, warnings)


# ---------------------------------------------------------------------------
# 3. T-TEST / MANN-WHITNEY U
# ---------------------------------------------------------------------------

def run_t_test(df: pd.DataFrame, value_col: str, group_col: str) -> dict:
    warnings: list[str] = []
    groups = df[group_col].dropna().unique()
    if len(groups) != 2:
        raise ValueError(f"t-test requires exactly 2 groups in '{group_col}', found {len(groups)}")

    g1 = df[df[group_col] == groups[0]][value_col].dropna()
    g2 = df[df[group_col] == groups[1]][value_col].dropna()

    normal1 = _check_normality(g1)
    normal2 = _check_normality(g2)
    use_parametric = normal1 and normal2

    if not use_parametric:
        warnings.append(
            "Normality assumption violated for one or both groups. "
            "Mann-Whitney U test used instead of independent t-test."
        )
        stat, p = stats.mannwhitneyu(g1, g2, alternative="two-sided")
        test_name = "Mann-Whitney U"
        effect = None
    else:
        _, p_levene = stats.levene(g1, g2)
        equal_var = p_levene > 0.05
        if not equal_var:
            warnings.append("Levene's test significant (p < 0.05) — Welch's t-test used.")
        stat, p = stats.ttest_ind(g1, g2, equal_var=equal_var)
        test_name = "Welch's t-test" if not equal_var else "Independent t-test"
        # Cohen's d
        pooled_sd = math.sqrt(((len(g1) - 1) * g1.std()**2 + (len(g2) - 1) * g2.std()**2) /
                              (len(g1) + len(g2) - 2))
        effect = _fmt((g1.mean() - g2.mean()) / pooled_sd) if pooled_sd > 0 else None

    result_table = {
        "groups": {
            str(groups[0]): {"n": len(g1), "mean": _fmt(g1.mean()), "sd": _fmt(g1.std()), "median": _fmt(g1.median())},
            str(groups[1]): {"n": len(g2), "mean": _fmt(g2.mean()), "sd": _fmt(g2.std()), "median": _fmt(g2.median())},
        },
        "test": test_name,
        "statistic": _fmt(stat),
        "p_value": _fmt(p),
        "cohens_d": effect,
    }

    sig = _significance(p)
    interp = (
        f"{test_name} comparing '{value_col}' between {groups[0]} (n={len(g1)}) "
        f"and {groups[1]} (n={len(g2)}): {sig}."
    )
    if effect is not None:
        interp += f" Cohen's d = {effect} (effect size)."

    conclusion = (
        f"There {'is' if p < _ALPHA else 'is no'} statistically significant difference "
        f"in {value_col} between the two groups (p {'<' if p < _ALPHA else '≥'} 0.05)."
    )

    return _result(result_table, interp, _vl_boxplot(df, group_col, value_col), p, conclusion, warnings)


# ---------------------------------------------------------------------------
# 4. ANOVA / KRUSKAL-WALLIS
# ---------------------------------------------------------------------------

def run_anova(df: pd.DataFrame, value_col: str, group_col: str) -> dict:
    warnings: list[str] = []
    group_data = {
        str(g): df[df[group_col] == g][value_col].dropna()
        for g in df[group_col].dropna().unique()
    }
    if len(group_data) < 2:
        raise ValueError("ANOVA requires at least 2 groups")

    normal = all(_check_normality(v) for v in group_data.values())
    if not normal:
        warnings.append("Normality violated — Kruskal-Wallis test used instead of ANOVA.")
        stat, p = stats.kruskal(*group_data.values())
        test_name = "Kruskal-Wallis H"
        eta2 = None
    else:
        stat, p = stats.f_oneway(*group_data.values())
        test_name = "One-Way ANOVA (F)"
        # Eta-squared
        all_vals = np.concatenate(list(group_data.values()))
        ss_between = sum(len(v) * (v.mean() - all_vals.mean())**2 for v in group_data.values())
        ss_total = sum((v - all_vals.mean())**2 for v in all_vals)
        eta2 = _fmt(ss_between / ss_total) if ss_total > 0 else None

    group_stats = {
        g: {"n": len(v), "mean": _fmt(v.mean()), "sd": _fmt(v.std()), "median": _fmt(v.median())}
        for g, v in group_data.items()
    }

    result_table = {
        "groups": group_stats,
        "test": test_name,
        "statistic": _fmt(stat),
        "p_value": _fmt(p),
        "eta_squared": eta2,
    }

    sig = _significance(p)
    interp = (
        f"{test_name} comparing '{value_col}' across {len(group_data)} groups: {sig}."
    )
    if eta2 is not None:
        interp += f" η² = {eta2} (proportion of variance explained)."

    conclusion = (
        f"There {'is' if p < _ALPHA else 'is no'} statistically significant difference "
        f"in {value_col} across groups (p {'<' if p < _ALPHA else '≥'} 0.05)."
    )

    return _result(result_table, interp, _vl_boxplot(df, group_col, value_col), p, conclusion, warnings)


# ---------------------------------------------------------------------------
# 5. CORRELATION
# ---------------------------------------------------------------------------

def run_correlation(df: pd.DataFrame, x_col: str, y_col: str) -> dict:
    warnings: list[str] = []
    data = df[[x_col, y_col]].dropna()
    n = len(data)

    normal_x = _check_normality(data[x_col])
    normal_y = _check_normality(data[y_col])

    if normal_x and normal_y:
        r, p = stats.pearsonr(data[x_col], data[y_col])
        method = "Pearson"
    else:
        r, p = stats.spearmanr(data[x_col], data[y_col])
        method = "Spearman"
        warnings.append("Non-normal data detected — Spearman rank correlation used.")

    result_table = {
        "method": method,
        "r": _fmt(r),
        "p_value": _fmt(p),
        "n": n,
        "r_squared": _fmt(r**2),
    }

    strength = (
        "weak" if abs(r) < 0.3 else
        "moderate" if abs(r) < 0.6 else
        "strong"
    )
    direction = "positive" if r >= 0 else "negative"
    sig = _significance(p)
    interp = (
        f"{method} correlation between '{x_col}' and '{y_col}' (n={n}): "
        f"r = {_fmt(r)}, {sig}. This represents a {strength} {direction} correlation."
    )
    conclusion = (
        f"There {'is' if p < _ALPHA else 'is no'} statistically significant {direction} "
        f"correlation between {x_col} and {y_col} (r = {_fmt(r)}, p {'<' if p < _ALPHA else '≥'} 0.05)."
    )

    return _result(result_table, interp, _vl_scatter(data, x_col, y_col), p, conclusion, warnings)


# ---------------------------------------------------------------------------
# 6. LINEAR REGRESSION
# ---------------------------------------------------------------------------

def run_linear_regression(
    df: pd.DataFrame,
    outcome: str,
    predictors: list[str],
) -> dict:
    data = df[[outcome] + predictors].dropna()
    y = data[outcome]
    X = sm.add_constant(data[predictors])

    model = sm.OLS(y, X).fit()
    coef_df = pd.DataFrame({
        "variable": model.params.index.tolist(),
        "coefficient": [_fmt(v) for v in model.params.values],
        "std_error": [_fmt(v) for v in model.bse.values],
        "t_stat": [_fmt(v) for v in model.tvalues.values],
        "p_value": [_fmt(v) for v in model.pvalues.values],
        "ci_low": [_fmt(v) for v in model.conf_int()[0].values],
        "ci_high": [_fmt(v) for v in model.conf_int()[1].values],
    })

    result_table = {
        "coefficients": coef_df.to_dict(orient="records"),
        "r_squared": _fmt(model.rsquared),
        "adj_r_squared": _fmt(model.rsquared_adj),
        "f_statistic": _fmt(model.fvalue),
        "f_p_value": _fmt(model.f_pvalue),
        "n": int(model.nobs),
        "aic": _fmt(model.aic),
    }

    interp = (
        f"Multiple linear regression with '{outcome}' as outcome and "
        f"{', '.join(predictors)} as predictor(s). "
        f"R² = {_fmt(model.rsquared)} — the model explains "
        f"{_fmt(model.rsquared * 100)}% of variance in {outcome}. "
        f"F({int(model.df_model)}, {int(model.df_resid)}) = {_fmt(model.fvalue)}, "
        f"{_significance(model.f_pvalue)}."
    )
    conclusion = (
        f"The regression model {'is' if model.f_pvalue < _ALPHA else 'is not'} "
        f"statistically significant (R² = {_fmt(model.rsquared)}, "
        f"p {'<' if model.f_pvalue < _ALPHA else '≥'} 0.05)."
    )

    # Coefficient plot (Vega-Lite)
    coef_no_intercept = coef_df[coef_df["variable"] != "const"]
    chart = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": {"type": "point", "filled": True},
        "data": {"values": coef_no_intercept.to_dict(orient="records")},
        "encoding": {
            "y": {"field": "variable", "type": "nominal", "title": "Predictor"},
            "x": {"field": "coefficient", "type": "quantitative", "title": "Coefficient"},
            "x2": {"field": "ci_high"},
            "color": {
                "condition": {"test": "datum.p_value < 0.05", "value": "#0D9488"},
                "value": "#94a3b8",
            },
        },
        "layer": [
            {"mark": {"type": "rule"}, "encoding": {"x": {"field": "ci_low"}, "x2": {"field": "ci_high"}}},
            {"mark": {"type": "point", "filled": True}, "encoding": {"x": {"field": "coefficient"}}},
        ],
    }

    return _result(result_table, interp, chart, model.f_pvalue, conclusion)


# ---------------------------------------------------------------------------
# 7. LOGISTIC REGRESSION
# ---------------------------------------------------------------------------

def run_logistic_regression(
    df: pd.DataFrame,
    outcome: str,
    predictors: list[str],
) -> dict:
    data = df[[outcome] + predictors].dropna()
    y = data[outcome].astype(int)
    X = sm.add_constant(data[predictors].astype(float))

    model = sm.Logit(y, X).fit(disp=False)
    ci = model.conf_int()
    or_df = pd.DataFrame({
        "variable": model.params.index.tolist(),
        "log_or": [_fmt(v) for v in model.params.values],
        "odds_ratio": [_fmt(math.exp(v)) for v in model.params.values],
        "ci_low_or": [_fmt(math.exp(v)) for v in ci[0].values],
        "ci_high_or": [_fmt(math.exp(v)) for v in ci[1].values],
        "p_value": [_fmt(v) for v in model.pvalues.values],
    })

    result_table = {
        "coefficients": or_df.to_dict(orient="records"),
        "pseudo_r_squared": _fmt(model.prsquared),
        "log_likelihood": _fmt(model.llf),
        "aic": _fmt(model.aic),
        "n": int(model.nobs),
    }

    interp = (
        f"Logistic regression predicting binary outcome '{outcome}'. "
        f"McFadden's pseudo-R² = {_fmt(model.prsquared)}. "
        "Odds ratios with 95% confidence intervals are reported."
    )
    conclusion = (
        f"The logistic regression model has pseudo-R² = {_fmt(model.prsquared)}, "
        f"AIC = {_fmt(model.aic)}."
    )

    # Forest plot for ORs
    or_no_intercept = [r for r in or_df.to_dict(orient="records") if r["variable"] != "const"]
    chart = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "layer": [
            {
                "mark": "rule",
                "data": {"values": or_no_intercept},
                "encoding": {
                    "y": {"field": "variable", "type": "nominal"},
                    "x": {"field": "ci_low_or", "type": "quantitative", "title": "Odds Ratio"},
                    "x2": {"field": "ci_high_or"},
                },
            },
            {
                "mark": {"type": "point", "filled": True, "size": 100},
                "data": {"values": or_no_intercept},
                "encoding": {
                    "y": {"field": "variable", "type": "nominal"},
                    "x": {"field": "odds_ratio", "type": "quantitative"},
                    "color": {
                        "condition": {"test": "datum.p_value < 0.05", "value": "#0D9488"},
                        "value": "#94a3b8",
                    },
                },
            },
        ],
    }

    return _result(result_table, interp, chart, None, conclusion)


# ---------------------------------------------------------------------------
# 8. ODDS RATIO (2×2 table)
# ---------------------------------------------------------------------------

def run_odds_ratio(
    df: pd.DataFrame,
    exposure_col: str,
    outcome_col: str,
    exposed_value: Any = 1,
    outcome_value: Any = 1,
) -> dict:
    a = int(((df[exposure_col] == exposed_value) & (df[outcome_col] == outcome_value)).sum())
    b = int(((df[exposure_col] == exposed_value) & (df[outcome_col] != outcome_value)).sum())
    c = int(((df[exposure_col] != exposed_value) & (df[outcome_col] == outcome_value)).sum())
    d = int(((df[exposure_col] != exposed_value) & (df[outcome_col] != outcome_value)).sum())

    table = Table2x2([[a, b], [c, d]])
    or_val = table.oddsratio
    ci = table.oddsratio_confint()
    p = table.test_nominal_association().pvalue

    result_table = {
        "2x2_table": {"a": a, "b": b, "c": c, "d": d},
        "odds_ratio": _fmt(or_val),
        "ci_95_low": _fmt(ci[0]),
        "ci_95_high": _fmt(ci[1]),
        "p_value": _fmt(p),
    }

    interp = (
        f"Odds Ratio = {_fmt(or_val)} (95% CI: {_fmt(ci[0])}–{_fmt(ci[1])}), {_significance(p)}. "
        f"Exposure: '{exposure_col}' = {exposed_value}; Outcome: '{outcome_col}' = {outcome_value}."
    )
    conclusion = (
        f"The odds of the outcome are {_fmt(or_val):.2f}× {'higher' if or_val >= 1 else 'lower'} "
        f"in the exposed group compared to unexposed "
        f"({'statistically significant' if p < _ALPHA else 'not statistically significant'})."
    )

    return _result(result_table, interp, None, p, conclusion)


# ---------------------------------------------------------------------------
# 9. RISK RATIO (2×2 table)
# ---------------------------------------------------------------------------

def run_risk_ratio(
    df: pd.DataFrame,
    exposure_col: str,
    outcome_col: str,
    exposed_value: Any = 1,
    outcome_value: Any = 1,
) -> dict:
    a = int(((df[exposure_col] == exposed_value) & (df[outcome_col] == outcome_value)).sum())
    b = int(((df[exposure_col] == exposed_value) & (df[outcome_col] != outcome_value)).sum())
    c = int(((df[exposure_col] != exposed_value) & (df[outcome_col] == outcome_value)).sum())
    d = int(((df[exposure_col] != exposed_value) & (df[outcome_col] != outcome_value)).sum())

    n1, n0 = a + b, c + d
    if n1 == 0 or n0 == 0:
        raise ValueError("One exposure group has zero observations")

    rr = (a / n1) / (c / n0) if c > 0 else float("inf")
    log_rr_se = math.sqrt(1/a - 1/n1 + 1/c - 1/n0) if a > 0 and c > 0 else None
    ci_low = math.exp(math.log(rr) - 1.96 * log_rr_se) if log_rr_se else None
    ci_high = math.exp(math.log(rr) + 1.96 * log_rr_se) if log_rr_se else None

    _, p, _, _ = stats.chi2_contingency([[a, b], [c, d]])

    result_table = {
        "2x2_table": {"a": a, "b": b, "c": c, "d": d},
        "risk_exposed": _fmt(a / n1),
        "risk_unexposed": _fmt(c / n0),
        "risk_ratio": _fmt(rr),
        "ci_95_low": _fmt(ci_low),
        "ci_95_high": _fmt(ci_high),
        "p_value": _fmt(p),
    }

    interp = (
        f"Risk in exposed = {_fmt(a/n1):.4f}, Risk in unexposed = {_fmt(c/n0):.4f}. "
        f"Risk Ratio = {_fmt(rr)} (95% CI: {_fmt(ci_low)}–{_fmt(ci_high)}), {_significance(p)}."
    )
    conclusion = (
        f"The risk of the outcome is {_fmt(rr):.2f}× {'higher' if rr >= 1 else 'lower'} "
        f"in the exposed group "
        f"({'statistically significant' if p < _ALPHA else 'not statistically significant'})."
    )

    return _result(result_table, interp, None, p, conclusion)


# ---------------------------------------------------------------------------
# 10. EPIDEMIOLOGY: ATTACK RATE, INCIDENCE, PREVALENCE, CFR
# ---------------------------------------------------------------------------

def run_attack_rate(cases: int, at_risk: int) -> dict:
    ar = cases / at_risk if at_risk > 0 else None
    result_table = {
        "cases": cases, "at_risk": at_risk,
        "attack_rate": _fmt(ar),
        "attack_rate_percent": _fmt(ar * 100) if ar else None,
    }
    interp = f"Attack rate = {_fmt(ar * 100):.2f}% ({cases} cases / {at_risk} at-risk population)."
    return _result(result_table, interp, None, None, interp)


def run_incidence_rate(new_cases: int, person_time: float, unit: str = "100,000 person-years") -> dict:
    ir = (new_cases / person_time) * 100_000 if person_time > 0 else None
    result_table = {
        "new_cases": new_cases,
        "person_time": person_time,
        "incidence_rate_per_100k": _fmt(ir),
        "unit": unit,
    }
    interp = f"Incidence rate = {_fmt(ir)} per {unit} ({new_cases} new cases / {person_time} person-time)."
    return _result(result_table, interp, None, None, interp)


def run_prevalence(cases: int, population: int) -> dict:
    prev = cases / population if population > 0 else None
    result_table = {
        "cases": cases, "population": population,
        "prevalence": _fmt(prev),
        "prevalence_percent": _fmt(prev * 100) if prev else None,
        "prevalence_per_1000": _fmt(prev * 1000) if prev else None,
    }
    interp = f"Prevalence = {_fmt(prev * 100):.2f}% ({cases} cases in {population} population)."
    return _result(result_table, interp, None, None, interp)


def run_cfr(deaths: int, cases: int) -> dict:
    cfr = deaths / cases if cases > 0 else None
    result_table = {
        "deaths": deaths, "cases": cases,
        "cfr": _fmt(cfr),
        "cfr_percent": _fmt(cfr * 100) if cfr else None,
    }
    interp = f"Case-fatality rate (CFR) = {_fmt(cfr * 100):.2f}% ({deaths} deaths / {cases} cases)."
    return _result(result_table, interp, None, None, interp)


# ---------------------------------------------------------------------------
# 11. FOREST PLOT DATA BUILDER
# ---------------------------------------------------------------------------

def build_forest_plot(studies: list[dict]) -> dict:
    """
    Build Vega-Lite forest plot spec from a list of study estimates.

    Parameters
    ----------
    studies:
        Each dict must have:
          - "study": str  (label)
          - "estimate": float  (e.g. OR, RR, mean difference)
          - "ci_low": float
          - "ci_high": float
          Optional: "weight": float, "year": int
    """
    # Pooled estimate via inverse-variance weighting (fixed-effects)
    weights = []
    estimates = []
    for s in studies:
        se = (math.log(s["ci_high"]) - math.log(s["ci_low"])) / (2 * 1.96) if s.get("ci_low") and s.get("ci_high") else 0.1
        w = 1 / se**2 if se > 0 else 0
        weights.append(w)
        estimates.append(s["estimate"])

    total_weight = sum(weights)
    pooled = sum(e * w for e, w in zip(estimates, weights)) / total_weight if total_weight > 0 else None
    pooled_se = math.sqrt(1 / total_weight) if total_weight > 0 else None
    pooled_low = pooled - 1.96 * pooled_se if pooled and pooled_se else None
    pooled_high = pooled + 1.96 * pooled_se if pooled and pooled_se else None

    chart_values = [
        {
            "study": s["study"],
            "estimate": s["estimate"],
            "ci_low": s["ci_low"],
            "ci_high": s["ci_high"],
            "weight": round(w / total_weight * 100, 1) if total_weight > 0 else None,
        }
        for s, w in zip(studies, weights)
    ]
    if pooled:
        chart_values.append({
            "study": "Pooled (FE)",
            "estimate": _fmt(pooled),
            "ci_low": _fmt(pooled_low),
            "ci_high": _fmt(pooled_high),
            "weight": 100.0,
        })

    chart = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "layer": [
            {
                "mark": "rule",
                "data": {"values": chart_values},
                "encoding": {
                    "y": {"field": "study", "type": "nominal", "sort": None},
                    "x": {"field": "ci_low", "type": "quantitative", "title": "Estimate (95% CI)"},
                    "x2": {"field": "ci_high"},
                },
            },
            {
                "mark": {"type": "point", "filled": True},
                "data": {"values": chart_values},
                "encoding": {
                    "y": {"field": "study", "type": "nominal", "sort": None},
                    "x": {"field": "estimate", "type": "quantitative"},
                    "size": {"field": "weight", "type": "quantitative"},
                    "color": {
                        "condition": {"test": "datum.study === 'Pooled (FE)'", "value": "#0F172A"},
                        "value": "#0D9488",
                    },
                },
            },
        ],
    }

    result_table = {
        "studies": chart_values,
        "pooled_estimate": _fmt(pooled),
        "pooled_ci_low": _fmt(pooled_low),
        "pooled_ci_high": _fmt(pooled_high),
        "i2": None,  # Heterogeneity requires Cochran's Q — extend as needed
    }

    interp = (
        f"Forest plot for {len(studies)} studies. "
        f"Pooled estimate (fixed-effects): {_fmt(pooled)} "
        f"(95% CI: {_fmt(pooled_low)}–{_fmt(pooled_high)})."
    )

    return _result(result_table, interp, chart, None, interp)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def run_analysis(df: pd.DataFrame, analysis_type: str, params: dict) -> dict:
    """
    Dispatch to the appropriate analysis function.

    Parameters
    ----------
    df:             pandas DataFrame
    analysis_type:  one of the supported type strings (see module docstring)
    params:         analysis-specific parameters dict

    Raises
    ------
    ValueError
        If analysis_type is unknown or required params are missing.
    """
    t = analysis_type.lower()

    if t == "descriptive":
        return run_descriptive(df, params["columns"])
    elif t == "chi_square":
        return run_chi_square(df, params["row_var"], params["col_var"])
    elif t == "t_test":
        return run_t_test(df, params["value_col"], params["group_col"])
    elif t == "anova":
        return run_anova(df, params["value_col"], params["group_col"])
    elif t == "correlation":
        return run_correlation(df, params["x_col"], params["y_col"])
    elif t == "linear_regression":
        return run_linear_regression(df, params["outcome"], params["predictors"])
    elif t == "logistic_regression":
        return run_logistic_regression(df, params["outcome"], params["predictors"])
    elif t == "odds_ratio":
        return run_odds_ratio(df, params["exposure_col"], params["outcome_col"],
                              params.get("exposed_value", 1), params.get("outcome_value", 1))
    elif t == "risk_ratio":
        return run_risk_ratio(df, params["exposure_col"], params["outcome_col"],
                              params.get("exposed_value", 1), params.get("outcome_value", 1))
    elif t == "attack_rate":
        return run_attack_rate(params["cases"], params["at_risk"])
    elif t == "incidence_rate":
        return run_incidence_rate(params["new_cases"], params["person_time"], params.get("unit", "100,000 person-years"))
    elif t == "prevalence":
        return run_prevalence(params["cases"], params["population"])
    elif t == "cfr":
        return run_cfr(params["deaths"], params["cases"])
    elif t == "forest_plot":
        return build_forest_plot(params["studies"])
    else:
        raise ValueError(f"Unknown analysis_type: {analysis_type!r}")
