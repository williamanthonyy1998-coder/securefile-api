import {Link} from 'react-router-dom';

export default function PaymentSuccess(){
 return <div className="auth"><div className="form-card"><div className="success" style={{fontWeight:700}}>Payment received</div><h1>Your SecureFile subscription is being activated.</h1><p>Stripe has confirmed your checkout. SecureFile will activate the workspace from the signed payment webhook. You can now verify your email if you have not already done so, then sign in.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="btn" to="/login">Go to Login</Link><Link className="btn secondary" to="/">Back to SecureFile</Link></div></div></div>;
}
