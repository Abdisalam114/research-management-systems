import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { filterByStatKey, isAwardedItem, statFilterLabel } from "../utils/pageHeaderFilters";

function GrantAmounts({ grant }) {
  const requested = Number(grant.amountRequested || 0);
  const awarded = Number(grant.amountAwarded || 0);
  const currency = grant.currency || "USD";
  const fmt = (n) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.45)",
        border: "1px solid rgba(56,189,248,0.12)",
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
          Requested
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", marginTop: 2 }}>{fmt(requested)}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
          Awarded
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 15,
            marginTop: 2,
            color: awarded > 0 ? "#38bdf8" : "#fbbf24",
          }}
        >
          {awarded > 0 ? fmt(awarded) : "Pending — not awarded yet"}
        </div>
      </div>
    </div>
  );
}

export function GrantsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const callIdFromUrl = searchParams.get("callId") || "";
  const [grants, setGrants] = useState([]);
  const [donorFilter, setDonorFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const isLeadership = user?.role === "leadership";
  const isDonor = user?.role === "donor_agency";
  const canViewAll = ["research_director", "finance_officer", "faculty_coordinator", "leadership", "donor_agency"].includes(
    user?.role
  );

  useEffect(() => {
    if (isDonor) setDonorFilter(true);
  }, [isDonor]);

  const load = useCallback(async () => {
    const grantParams = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
    const res = await grantApi.listGrants(accessToken, grantParams);
    const all = res.grants || [];
    // Funding-call applications only
    const withCall = all.filter((g) => Boolean(g.callId));
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "systemic-pass",
        hypothesisId: "S2",
        location: "Grants.jsx:load",
        message: "grants list for visibility",
        data: {
          totalFromApi: all.length,
          withCallId: withCall.length,
          drafts: withCall.filter((g) => g.status === "draft").length,
          acceptedStat: withCall.filter((g) =>
            ["pending_finance", "active", "approved"].includes(g.status)
          ).length,
          sample: withCall.slice(0, 3).map((g) => ({
            id: g.id,
            title: g.title,
            status: g.status,
            callId: g.callId,
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setGrants(withCall);
  }, [accessToken, projectIdFromUrl]);

  useEffect(() => {
    if (!callIdFromUrl || !accessToken) return;
    navigate(`/grants/apply?callId=${encodeURIComponent(callIdFromUrl)}`, { replace: true });
  }, [callIdFromUrl, accessToken, navigate]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => grants.filter((g) => g.status === s).length;
    const awardedCount = grants.filter(isAwardedItem).length;
    const totalAwarded = grants.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
    return [
      { label: "Total", value: grants.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted" },
      {
        label: "Accepted",
        value: by("pending_finance") + by("active") + by("approved"),
        filterKey: "accepted",
        accent: "#22c55e",
        sub: "Director accepted",
      },
      { label: "Pending finance", value: by("pending_finance"), filterKey: "pending_finance", accent: "#fcd34d" },
      { label: "Awarded", value: awardedCount, filterKey: "awarded", accent: "#1d4ed8", sub: "From funding calls" },
      { label: "Awarded $", value: `$${totalAwarded.toLocaleString()}`, accent: "#38bdf8", sub: "Total awarded amount" },
      { label: "Active", value: by("active"), filterKey: "active", accent: "#6366f1" },
    ];
  }, [grants]);

  const filteredGrants = useMemo(() => {
    let list = filterByStatKey(grants, statusFilter, {
      customFilters: {
        accepted: (g) => ["pending_finance", "active", "approved"].includes(g.status),
      },
    });
    if (donorFilter) list = list.filter((g) => g.donorRef && g.donorRef.trim());
    return list;
  }, [grants, statusFilter, donorFilter]);

  return (
    <div>
      <PageHeader
        title="Grants & Funding"
        subtitle={
          isDonor
            ? "Donor monitor view — funding-call applications only (read-only)."
            : canCreate
              ? "Your Funding Call applications appear here (Draft → Submit → Awarded). Start from an open call."
              : "Only applications from Funding Calls appear here. Start from an open call."
        }
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <Link className="btn primary" to="/funding-calls">
                Apply via Funding Calls
              </Link>
            ) : null}
            {isDonor ? (
              <Link className="btn primary" to="/donor-reports">
                Donor reports
              </Link>
            ) : null}
            {isDirector || isDonor ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={donorFilter} onChange={(e) => setDonorFilter(e.target.checked)} />
                Donor-funded only
              </label>
            ) : null}
          </>
        }
      />

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Filtered to one project — <Link to="/grants">show all funding-call grants</Link>
        </p>
      ) : null}
      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filteredGrants.length})
        </p>
      ) : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canCreate ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Grant applications are only created from an open <Link to="/funding-calls">Funding Call</Link>.
        </p>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Funding-call grants</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filteredGrants.map((g) => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{g.title}</div>
                    <StatusBadge
                      status={g.status === "active" ? "awarded" : g.status}
                      label={g.status === "active" ? "Awarded" : undefined}
                    />
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {g.fundingSource}
                    {g.donorRef ? ` • Donor ref: ${g.donorRef}` : ""}
                  </div>
                  {g.fundingCall?.title ? (
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Funding call: {g.fundingCall.title}
                    </div>
                  ) : null}
                  {g.project?.title ? (
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      <span className="muted">Linked project: </span>
                      <Link to={`/projects/${g.project.id}`} style={{ fontWeight: 700 }}>
                        {g.project.title}
                      </Link>
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                      No project linked yet
                    </div>
                  )}
                  {g.proposal?.title ? (
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Proposal: {g.proposal.title} ({g.proposal.status})
                    </div>
                  ) : null}
                  <GrantAmounts grant={g} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {canViewAll || canCreate ? (
                    <Link
                      className={(isDirector || isLeadership) && g.status === "submitted" ? "btn primary" : "btn"}
                      to={`/grants/${g.id}`}
                      title="View full grant details before deciding"
                    >
                      View details
                    </Link>
                  ) : null}
                  {canCreate && g.status === "draft" && g.callId ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={async () => {
                        try {
                          setError("");
                          await grantApi.submitGrant(accessToken, g.id);
                          await reload();
                        } catch (e) {
                          setError(e?.response?.data?.message || "Submit failed");
                        }
                      }}
                    >
                      Submit
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!loading && filteredGrants.length === 0 ? (
            <div className="muted">
              {grants.length === 0 ? (
                <>
                  No funding-call grant applications yet.{" "}
                  {canCreate ? (
                    <>
                      Open <Link to="/funding-calls">Funding Calls</Link> to apply.
                    </>
                  ) : null}
                </>
              ) : (
                "No grants match this filter."
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
