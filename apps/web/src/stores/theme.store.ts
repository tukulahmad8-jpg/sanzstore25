import { create } from 'zustand'
type Theme='light'|'dark'
interface ThemeState{theme:Theme;setTheme:(theme:Theme)=>void;toggleTheme:()=>void;hydrateTheme:()=>void}
function applyTheme(theme:Theme){document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('dark',theme==='dark');localStorage.setItem('sanz-theme',theme)}
export const useThemeStore=create<ThemeState>((set,get)=>({theme:'light',setTheme:(theme)=>{applyTheme(theme);set({theme})},toggleTheme:()=>{const next=get().theme==='dark'?'light':'dark';applyTheme(next);set({theme:next})},hydrateTheme:()=>{const saved=(localStorage.getItem('sanz-theme') as Theme|null)??'light';applyTheme(saved);set({theme:saved})}}))
