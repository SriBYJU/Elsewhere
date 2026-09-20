import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=ref.current;const previous=document.activeElement as HTMLElement;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><div className="section-heading"><span className="eyebrow">{title}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></div>{children}</div></dialog>;
}
