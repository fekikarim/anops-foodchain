import { useEffect, useState } from "react";

// Hash routing:  #/batches  #/batches/3  #/batches/new
const parse = () => {
  const [page = "overview", arg] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { page: page || "overview", arg: arg || null };
};
export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}
export const go = (page, arg) => { window.location.hash = `/${page}${arg ? "/" + arg : ""}`; };
