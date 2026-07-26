import { useContext } from "react";
import Header from "../components/Header";
import Hero from "../components/Hero";
import { AuthContext } from "../context/AuthContext";

export default function Home({ onLoaded }) {
  const { user } = useContext(AuthContext);

  return (
    <main className="relative w-full min-h-screen overflow-x-hidden">
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>
      <Header />
      <Hero onLoaded={onLoaded} />
    </main>
  );
}
