import { Link } from "react-router-dom";

export default function PaymentPending(){
  return <div className="auth"><div className="form-card">
    <p className="eyebrow">SecureFile account setup</p>
    <h1>Finish setup</h1>
    <p>Your workspace has been reserved. We sent a verification link to the admin email address you entered.</p>
    <div className="notice" style={{marginTop:16}}>
      <b>Next steps</b>
      <ol style={{margin:'10px 0 0 20px',lineHeight:1.7}}>
        <li>Open the SecureFile verification email and verify your email address.</li>
        <li>In the current free preview, no payment is required.</li>
        <li>After you connect Stripe later, paid subscriptions will activate from the signed Stripe webhook.</li>
        <li>Return here and sign in.</li>
      </ol>
    </div>
    <p className="muted" style={{marginTop:16}}>If you are using the free preview, verify your email and then sign in. Paid activation is handled automatically by SecureFile's signed Stripe webhook after Stripe is connected.</p>
    <Link className="btn" to="/login">Go to login</Link>
  </div></div>;
}
