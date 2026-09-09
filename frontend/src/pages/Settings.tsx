import SettingsPanel from "../components/settings/SettingsPanel";

export default function Settings() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
          <p>Review company and subscription settings.</p>
        </div>
      </div>
      <SettingsPanel />
    </>
  );
}
