import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import 'boxicons/css/boxicons.min.css';
import Spline from '@splinetool/react-spline';
import { AuthContext } from '../context/AuthContext';

const Hero = ({ onLoaded }) => {
  const { user, openAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <main className="relative flex flex-col lg:flex-row items-center justify-between min-h-[calc(90vh-6rem)] overflow-visible lg:mt-20">
      <div className="sm:hidden flex flex-col items-center w-full px-4 mt-8 text-center">
        <h1 className="text-3xl font-bold tracking-wider leading-tight">
          MT Club — Borg El-Arab Technology University
        </h1>
        <p className="text-base tracking-wider leading-relaxed mt-4" style={{ color: "var(--text-secondary)" }}>
          The driving force behind BATU's tech scene. We are a student-led organizing team dedicated to launching premier tech events, hackathons, and innovation exhibitions — connecting academic talent with the tech industry leaders.
        </p>
        <div className="flex flex-row gap-4 mt-8 items-center justify-center">
          <button onClick={() => navigate('/events')} className="border border-[#2a2a2a] py-2 px-5 rounded-full text-sm font-semibold tracking-wider transition-all duration-300 hover:bg-[#1a1a1a] hover:text-white flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-primary)" }}>
            Club Vision <i className="bx bx-link-external"></i>
          </button>
          {!user && (
            <button onClick={openAuth} className="border border-[#2a2a2a] py-2 px-8 rounded-full text-sm font-semibold tracking-wider transition-all duration-300 hover:bg-[#1a1a1a] bg-white text-black hover:text-white flex items-center gap-2 cursor-pointer">
              Join Us <i className="bx bx-link-external"></i>
            </button>
          )}
        </div>
      </div>

      <Spline
        scene="https://prod.spline.design/PxRiDc0Lj-9viOS9/scene.splinecode"
        onLoad={onLoaded}
        className="hidden lg:block lg:absolute lg:top-[-15%] lg:right-[-330px] lg:w-[1000px] lg:h-[1000px] lg:scale-[0.65] z-0"
      />

      <div className="hidden sm:block max-w-xl ml-[5%] z-10 mt-12 sm:mt-16 md:mt-20 lg:mt-0">
        <div className="inline-block rounded-full p-[2px] bg-gradient-to-r from-[#656565] to-[#00ACC1] shadow-[0_0_15px_rgba(255,255,255,0.4)]">
          <div className="bg-black rounded-full flex items-center justify-center gap-1 px-4 py-2 w-max" style={{ backgroundColor: "var(--bg-primary)" }}>
            <i className="bx bx-diamond"></i>
            MT CLUB
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-wider my-8 leading-tight">
          MT Club — Borg El-Arab Technology University
        </h1>

        <p className="text-base sm:text-lg tracking-wider leading-relaxed max-w-[30rem]" style={{ color: "var(--text-secondary)" }}>
          The driving force behind BATU's tech scene. We are a student-led organizing team dedicated to launching premier tech events, hackathons, and innovation exhibitions — connecting academic talent with the tech industry leaders.
        </p>

        <div className="flex flex-row gap-4 mt-12 items-start">
          <button onClick={() => navigate('/events')} className="border border-[#2a2a2a] py-2 px-5 rounded-full text-sm sm:text-lg font-semibold tracking-wider transition-all duration-300 hover:bg-[#1a1a1a] hover:text-white flex items-center gap-2 w-max cursor-pointer" style={{ color: "var(--text-primary)" }}>
            Club Vision <i className="bx bx-link-external"></i>
          </button>
          {!user && (
            <button onClick={openAuth} className="border border-[#2a2a2a] py-2 px-8 rounded-full text-sm sm:text-lg font-semibold tracking-wider transition-all duration-300 hover:bg-[#1a1a1a] bg-white text-black hover:text-white flex items-center gap-2 w-max cursor-pointer">
              Join Us <i className="bx bx-link-external"></i>
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default Hero;
