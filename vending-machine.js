    const { useState, useEffect } = React;

    const playSynthSound = (type) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (type === 'click') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.09);
        } else if (type === 'insert_coin') {
          const now = ctx.currentTime;
          [0, 0.06].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2200 - (delay * 2000), now + delay);
            osc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.1);
            gain.gain.setValueAtTime(0.15, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.15);
          });
        } else if (type === 'insert_bill') {
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(90, now);
          osc1.frequency.linearRampToValueAtTime(140, now + 1.2);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(95, now);
          osc2.frequency.linearRampToValueAtTime(145, now + 1.2);
          gain.gain.setValueAtTime(0.0, now);
          gain.gain.linearRampToValueAtTime(0.06, now + 0.1);
          gain.gain.linearRampToValueAtTime(0.06, now + 1.0);
          gain.gain.linearRampToValueAtTime(0.0, now + 1.2);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.2);
          osc2.stop(now + 1.2);
        } else if (type === 'motor') {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(60, now);
          osc.frequency.linearRampToValueAtTime(62, now + 1.5);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(180, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 1.3);
          gain.gain.linearRampToValueAtTime(0.0, now + 1.5);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.5);
        } else if (type === 'dispense_clunk') {
          const osc = ctx.createOscillator();
          const noise = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
          noise.type = 'triangle';
          noise.frequency.setValueAtTime(50, ctx.currentTime);
          noise.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          noise.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          noise.start();
          osc.stop(ctx.currentTime + 0.45);
          noise.stop(ctx.currentTime + 0.45);
        } else if (type === 'success') {
          const melody = [523.25, 659.25, 783.99, 1046.50];
          const now = ctx.currentTime;
          melody.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
            gain.gain.setValueAtTime(0.1, now + (idx * 0.08));
            gain.gain.exponentialRampToValueAtTime(0.01, now + (idx * 0.08) + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + (idx * 0.08));
            osc.stop(now + (idx * 0.08) + 0.3);
          });
        } else if (type === 'error') {
          const now = ctx.currentTime;
          [0, 0.15].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now + delay);
            gain.gain.setValueAtTime(0.12, now + delay);
            gain.gain.linearRampToValueAtTime(0.01, now + delay + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.14);
          });
        }
      } catch (err) {
        // Audio playback fallback
      }
    };

    const CocaColaSVG = () => (
      <svg viewBox="0 0 100 40" className="w-10 h-auto fill-white drop-shadow-md">
        <text x="50%" y="24" textAnchor="middle" fontSize="13" fontWeight="900" fontStyle="italic" className="tracking-tight">Coke</text>
        <path d="M 10,26 Q 35,16 55,26 T 90,24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
      </svg>
    );

    const PepsiSVG = () => (
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-white flex flex-col overflow-hidden shadow-md relative">
          <div className="h-[40%] bg-red-600 w-full"></div>
          <div className="h-[20%] bg-white w-full -skew-y-12 transform scale-110"></div>
          <div className="h-[40%] bg-blue-700 w-full"></div>
        </div>
        <span className="text-[6px] font-black tracking-widest mt-0.5 text-white">PEPSI</span>
      </div>
    );

    const MonsterSVG = () => (
      <div className="flex flex-col items-center justify-center">
        <div className="flex space-x-[2px] items-center">
          <div className="w-[1.5px] h-5 bg-lime-400 rotate-12 rounded"></div>
          <div className="w-[2px] h-6 bg-lime-400 -skew-x-12 rounded"></div>
          <div className="w-[1.5px] h-5 bg-lime-400 rotate-12 rounded"></div>
        </div>
        <span className="text-[5px] font-bold text-lime-400 tracking-wider">MONSTER</span>
      </div>
    );

    const RedBullSVG = () => (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center relative shadow-inner">
          <div className="absolute w-4 h-1.5 bg-red-600 -rotate-12 -translate-x-[1px]"></div>
          <div className="absolute w-4 h-1.5 bg-red-600 rotate-12 translate-x-[1px]"></div>
        </div>
        <span className="text-[5px] font-extrabold mt-0.5 text-white tracking-widest">RED BULL</span>
      </div>
    );

    const SevenUpSVG = () => (
      <div className="flex items-center justify-center space-x-0.5">
        <span className="text-lg font-black italic text-white leading-none drop-shadow">7</span>
        <div className="flex flex-col items-center">
          <div className="w-2 h-2 bg-red-600 rounded-full border border-white"></div>
          <span className="text-[4px] font-bold text-green-300">UP</span>
        </div>
      </div>
    );

    const WaterBottleSVG = ({ brand }) => (
      <div className="flex flex-col items-center">
        <div className="w-3.5 h-1 bg-blue-300 rounded-t-sm border-b border-blue-500/30"></div>
        <div className="w-4.5 h-9 bg-white/40 border border-white/20 rounded flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-white/20"></div>
          <div className="w-full py-0.5 bg-blue-600 text-[5px] font-extrabold text-white text-center italic tracking-tighter uppercase leading-none">
            {brand}
          </div>
        </div>
      </div>
    );

    const LaySVG = () => (
      <div className="flex flex-col items-center">
        <div className="w-8 h-10 bg-yellow-500 rounded-md relative flex items-center justify-center overflow-hidden border border-yellow-300 shadow">
          <div className="absolute w-4 h-4 bg-red-600 rounded-full -top-1"></div>
          <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full border border-yellow-200 z-10 shadow-sm"></div>
          <span className="absolute bottom-1 text-[5px] font-bold text-white uppercase tracking-tighter">LAYS</span>
        </div>
      </div>
    );

    const OreoSVG = () => (
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 bg-blue-800 rounded border-2 border-blue-400 flex flex-col items-center justify-center relative overflow-hidden shadow-md">
          <div className="w-6 h-6 rounded-full bg-cyan-900 border border-cyan-400 flex items-center justify-center">
            <span className="text-[5px] text-white font-extrabold italic">OREO</span>
          </div>
        </div>
      </div>
    );

    const KitKatSVG = () => (
      <div className="flex flex-col items-center">
        <div className="w-9 h-6.5 bg-red-700 rounded border border-red-500 flex items-center justify-center relative shadow">
          <span className="text-[6px] text-white font-black tracking-tight leading-none italic uppercase">KitKat</span>
        </div>
      </div>
    );

    const DoritosSVG = () => (
      <div className="flex flex-col items-center">
        <div className="w-8 h-10 bg-gradient-to-b from-orange-600 to-red-800 rounded-md border border-orange-500 flex flex-col items-center justify-between py-1 relative overflow-hidden shadow">
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[15px] border-b-yellow-500 shadow-sm"></div>
          <span className="text-[4.5px] text-white font-black tracking-widest leading-none">DORITOS</span>
        </div>
      </div>
    );

    const VendingSimulator = () => {
      const [step, setStep] = useState('idle');
      const [balance, setBalance] = useState(0);
      const [inputCode, setInputCode] = useState('');
      const [selectedItem, setSelectedItem] = useState(null);
      const [displayMsg, setDisplayMsg] = useState('WELCOME');
      const [returnedCoins, setReturnedCoins] = useState([]);
      const [soundOn, setSoundOn] = useState(true);
      const [currentTheme, setCurrentTheme] = useState('cyan');
      const [spinningCoil, setSpinningCoil] = useState(null);

      const [inventory, setInventory] = useState([
        { id: 'A1', name: 'Coca-Cola', price: 15000, color: 'bg-red-600', logo: <CocaColaSVG />, stock: 5 },
        { id: 'A2', name: 'Pepsi Cola', price: 15000, color: 'bg-blue-800', logo: <PepsiSVG />, stock: 4 },
        { id: 'A3', name: '7-Up Fizz', price: 12000, color: 'bg-emerald-600', logo: <SevenUpSVG />, stock: 3 },
        { id: 'A4', name: 'Monster Green', price: 30000, color: 'bg-zinc-900 border border-lime-500/40', logo: <MonsterSVG />, stock: 6 },
        
        { id: 'B1', name: 'La Vie Water', price: 8000, color: 'bg-cyan-500', logo: <WaterBottleSVG brand="LAVIE" />, stock: 8 },
        { id: 'B2', name: 'Aquafina Pure', price: 8000, color: 'bg-blue-600', logo: <WaterBottleSVG brand="AQUA" />, stock: 7 },
        { id: 'B3', name: 'Red Bull Energy', price: 25000, color: 'bg-amber-500', logo: <RedBullSVG />, stock: 5 },
        { id: 'B4', name: 'Sting Nitro', price: 15000, color: 'bg-pink-600', logo: <span className="text-[9px] font-black italic tracking-tighter text-white">STING</span>, stock: 2 },
        
        { id: 'C1', name: 'Lay\'s Classic', price: 18000, color: 'bg-yellow-600', logo: <LaySVG />, stock: 4 },
        { id: 'C2', name: 'KitKat Wafer', price: 15000, color: 'bg-red-700', logo: <KitKatSVG />, stock: 5 },
        { id: 'C3', name: 'Oreo Double', price: 16000, color: 'bg-blue-900', logo: <OreoSVG />, stock: 6 },
        { id: 'C4', name: 'Doritos Tangy', price: 20000, color: 'bg-orange-700', logo: <DoritosSVG />, stock: 3 }
      ]);

      const VND = (val) => val.toLocaleString('vi-VN') + 'đ';

      const playSound = (soundType) => {
        if (soundOn) playSynthSound(soundType);
      };

      useEffect(() => {
        if (step === 'idle') {
          if (inputCode) {
            setDisplayMsg(`SLOT: ${inputCode}`);
          } else {
            const messages = ['INSERT CASH OR INPUT CODE', 'WELCOME TO SMARTDRINKS', 'SCAN QR TO INSTANTLY PAY'];
            let msgIdx = 0;
            setDisplayMsg(messages[0]);
            
            const interval = setInterval(() => {
              if (step === 'idle' && !inputCode) {
                msgIdx = (msgIdx + 1) % messages.length;
                setDisplayMsg(messages[msgIdx]);
              }
            }, 5000);
            return () => clearInterval(interval);
          }
        }
      }, [inputCode, step]);

      const handleKeypad = (val) => {
        playSound('click');
        if (step !== 'idle' && step !== 'selected' && step !== 'payment') return;

        if (val === 'ENTER') {
          const item = inventory.find(i => i.id === inputCode.toUpperCase());
          if (item) {
            if (item.stock <= 0) {
              playSound('error');
              setDisplayMsg('SOLD OUT - RE-SELECT');
              setTimeout(() => setInputCode(''), 2000);
            } else {
              setSelectedItem(item);
              if (balance >= item.price) {
                processDispense(item, balance);
              } else {
                setStep('selected');
                setDisplayMsg(`${item.name.toUpperCase()} - ${VND(item.price)}`);
              }
            }
          } else {
            playSound('error');
            setDisplayMsg('INVALID SELECTION');
            setTimeout(() => setInputCode(''), 1500);
          }
          return;
        }

        if (val === 'DEL') {
          setInputCode(prev => prev.slice(0, -1));
          if (inputCode.length <= 1) {
            setSelectedItem(null);
            setStep('idle');
          }
          return;
        }

        const newCode = (inputCode + val).slice(0, 2).toUpperCase();
        setInputCode(newCode);
      };

      const processDispense = (targetItem, activeBalance) => {
        setStep('processing');
        setDisplayMsg('PROCESSING...');
        
        setTimeout(() => {
          playSound('motor');
          setSpinningCoil(targetItem.id);
          setDisplayMsg('DISPENSING...');

          setTimeout(() => {
            playSound('dispense_clunk');
            setSpinningCoil(null);
            
            setInventory(prev => prev.map(item => {
              if (item.id === targetItem.id) {
                return { ...item, stock: item.stock - 1 };
              }
              return item;
            }));

            setStep('dispensing');
            setDisplayMsg('COLLECT PRODUCT');
            
            const remainingChange = activeBalance - targetItem.price;
            if (remainingChange > 0) {
              triggerChangeReturn(remainingChange);
            }
            setBalance(0);
          }, 1500);
        }, 1000);
      };

      const triggerChangeReturn = (amount) => {
        let currentVal = amount;
        const coinsToDrop = [];
        const denoms = [10000, 5000, 2000];
        
        denoms.forEach(val => {
          while (currentVal >= val) {
            coinsToDrop.push(val);
            currentVal -= val;
          }
        });
        
        if (currentVal > 0) coinsToDrop.push(currentVal);
        
        setTimeout(() => {
          playSound('insert_coin');
          setReturnedCoins(prev => [...prev, ...coinsToDrop]);
        }, 800);
      };

      const handleBillInsert = (amount) => {
        if (step !== 'idle' && step !== 'selected' && step !== 'payment') return;
        playSound('insert_bill');
        setStep('payment');

        const newBalance = balance + amount;
        setBalance(newBalance);
        setDisplayMsg(`CREDIT: ${VND(newBalance)}`);

        if (selectedItem && newBalance >= selectedItem.price) {
          processDispense(selectedItem, newBalance);
        }
      };

      const handleQRSimulation = () => {
        if (!selectedItem) {
          playSound('error');
          setDisplayMsg('SELECT PRODUCT FIRST');
          return;
        }
        playSound('insert_bill');
        setStep('payment');
        setDisplayMsg('SCANNING QR...');
        
        setTimeout(() => {
          playSound('success');
          setBalance(selectedItem.price);
          processDispense(selectedItem, selectedItem.price);
        }, 1800);
      };

      const collectProduct = () => {
        playSound('click');
        setStep('idle');
        setSelectedItem(null);
        setInputCode('');
      };

      const collectReturnedCoins = () => {
        if (returnedCoins.length === 0) return;
        playSound('insert_coin');
        setReturnedCoins([]);
        setDisplayMsg('CHANGE COLLECTED');
        setTimeout(() => setDisplayMsg('WELCOME'), 1200);
      };

      const handleReturnButton = () => {
        if (balance <= 0) {
          playSound('error');
          return;
        }
        playSound('click');
        triggerChangeReturn(balance);
        setBalance(0);
        setStep('idle');
        setSelectedItem(null);
        setInputCode('');
      };

      const getThemeColorClass = () => {
        switch(currentTheme) {
          case 'pink': return 'text-pink-500 border-pink-500 neon-glow-pink';
          case 'cyan': return 'text-cyan-400 border-cyan-400 neon-glow-cyan';
          case 'yellow': return 'text-yellow-400 border-yellow-400 neon-glow-yellow';
          default: return 'text-white border-white neon-glow-white';
        }
      };

      return (
        <div className="w-full max-w-[1020px] h-[640px] bg-zinc-900 rounded-[2rem] border-[10px] border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] flex overflow-hidden ring-1 ring-white/10 text-white relative">
          
          <div className={`absolute top-1 left-12 right-12 h-1 rounded-full transition-all duration-500 opacity-80 animate-led-pulse ${
            currentTheme === 'pink' ? 'bg-pink-500 shadow-[0_0_12px_#ec4899]' :
            currentTheme === 'cyan' ? 'bg-cyan-400 shadow-[0_0_12px_#06b6d4]' :
            currentTheme === 'yellow' ? 'bg-yellow-400 shadow-[0_0_12px_#eab308]' :
            'bg-zinc-200 shadow-[0_0_12px_#ffffff]'
          }`}></div>

          {/* LEFT CHAMBER */}
          <div className="flex-1 bg-zinc-950/40 p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden h-full">
            <div className={`absolute inset-0 transition-opacity duration-700 opacity-10 pointer-events-none ${
              currentTheme === 'pink' ? 'bg-pink-500' :
              currentTheme === 'cyan' ? 'bg-cyan-500' :
              currentTheme === 'yellow' ? 'bg-yellow-500' : 'bg-white'
            }`}></div>

            <div className="flex-1 grid grid-rows-3 gap-4 relative z-10 pt-2">
              {['A', 'B', 'C'].map((rowLetter) => (
                <div key={rowLetter} className="relative flex items-end justify-between pb-2 px-2 border-b border-zinc-800/60">
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 rounded shadow"></div>

                  {inventory.filter(i => i.id.startsWith(rowLetter)).map((item) => (
                    <div key={item.id} className="flex flex-col items-center relative group w-1/4">
                      <div className="absolute bottom-5 w-8 h-10 flex flex-col justify-between opacity-50 pointer-events-none z-0">
                        {[...Array(3)].map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`h-1.5 border-[1.5px] border-zinc-500 rounded-full w-full transform -skew-y-12 transition-transform duration-1000 ${
                              spinningCoil === item.id ? 'animate-coil' : ''
                            }`}
                          ></div>
                        ))}
                      </div>

                      <div className="relative h-18 flex items-end justify-center z-10">
                        {item.stock > 0 ? (
                          <div className={`w-11 h-16 ${item.color} rounded-md flex flex-col items-center justify-center text-white font-bold transition-all duration-1000 relative shadow-md ${
                            step === 'dispensing' && selectedItem?.id === item.id 
                              ? 'translate-y-52 rotate-45 scale-75 opacity-0 duration-[1100ms]' 
                              : 'group-hover:scale-105 group-hover:-translate-y-0.5'
                          }`}>
                            {item.logo}
                            <div className="absolute top-0.5 right-0.5 flex space-x-0.5">
                              {[...Array(Math.min(item.stock, 2))].map((_, dotIdx) => (
                                <div key={dotIdx} className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="w-11 h-16 bg-zinc-800/80 border border-zinc-700 rounded-md flex items-center justify-center text-zinc-600 font-black text-[8px] uppercase tracking-tighter">
                            SOLD OUT
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between w-12 px-1 py-0.5 bg-zinc-950/90 border border-zinc-800 rounded font-mono text-[8px] text-zinc-400 z-10 shadow">
                        <span className="font-bold text-white">{item.id}</span>
                        <span className="text-zinc-500">{VND(item.price).slice(0, -5)}k</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="absolute inset-0 glass-glare rounded-2xl z-20"></div>

            <div className="h-24 mt-3 bg-zinc-950 rounded-xl border-t-[5px] border-zinc-900 shadow-[inset_0_8px_16px_rgba(0,0,0,0.8)] relative flex items-center justify-center overflow-hidden z-20 group">
              <div className={`absolute top-0 inset-x-0 h-[1.5px] opacity-30 transition-colors ${
                currentTheme === 'pink' ? 'bg-pink-500' :
                currentTheme === 'cyan' ? 'bg-cyan-400' :
                currentTheme === 'yellow' ? 'bg-yellow-400' : 'bg-white'
              }`}></div>

              {step === 'dispensing' && selectedItem && (
                <div className="absolute animate-bounce flex flex-col items-center z-30">
                  <div className={`w-12 h-16 ${selectedItem.color} rounded-md shadow-2xl flex flex-col items-center justify-center border border-white/10 transform rotate-12`}>
                    {selectedItem.logo}
                  </div>
                  <button 
                    onClick={collectProduct}
                    className="mt-1 text-[9px] bg-emerald-500 hover:bg-emerald-400 text-black font-black px-3 py-1 rounded-full transition-all tracking-wider shadow-lg transform active:scale-95 cursor-pointer"
                  >
                    GRAB
                  </button>
                </div>
              )}

              <span className="text-zinc-800 font-extrabold text-xl tracking-[1.5rem] select-none pl-[1.5rem] group-hover:text-zinc-700 transition-colors">PUSH</span>
            </div>
          </div>

          {/* RIGHT CONTROL PANEL */}
          <div className="w-[330px] sm:w-[350px] bg-zinc-800 border-l-[5px] border-zinc-950 p-4 sm:p-5 flex flex-col justify-between h-full relative">
            <div>
              <div className="relative mb-3">
                <div className={`w-full h-24 bg-black/95 rounded-xl border-2 p-2.5 flex flex-col justify-between relative overflow-hidden transition-all duration-500 ${getThemeColorClass()}`}>
                  <div className="scanlines absolute inset-0 z-0 opacity-30"></div>
                  
                  <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-widest relative z-10 opacity-70">
                    <span>SYSTEM DIAG</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-1.5 h-1.5 rounded-full animate-ping ${
                        step === 'error' ? 'bg-red-500' : 'bg-emerald-400'
                      }`}></div>
                      <span>{step}</span>
                    </div>
                  </div>

                  <div className="my-auto text-center relative z-10 px-1">
                    <p className="font-lcd text-sm sm:text-base font-black tracking-tight uppercase leading-none truncate">
                      {displayMsg}
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-mono border-t border-white/10 pt-1 relative z-10">
                    <div>
                      <span className="text-zinc-500">CODE:</span>{' '}
                      <span className="font-bold">{inputCode || '--'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">CREDIT:</span>{' '}
                      <span className="font-bold text-green-400">{VND(balance)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {['A', 'B', 'C', '1', '2', '3', '4', 'DEL', 'ENTER'].map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKeypad(k)}
                    className={`h-9 bg-zinc-750 text-zinc-100 font-bold rounded-lg border-b-[3px] border-zinc-950 active:border-b-0 active:translate-y-1 hover:brightness-110 active:brightness-95 transition-all shadow flex items-center justify-center font-lcd cursor-pointer ${
                      k === 'ENTER' ? 'bg-blue-900 border-blue-950 text-blue-200 text-[10px]' : 
                      k === 'DEL' ? 'bg-red-950 border-red-950 text-red-300 text-[10px]' : 'text-sm'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-950">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400 mb-1">
                    Insert Banknotes
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[10000, 20000, 50000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => handleBillInsert(amt)}
                        className="py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all font-mono text-[10px] font-bold cursor-pointer"
                      >
                        +{VND(amt).replace('đ', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleQRSimulation}
                  className="w-full p-2 bg-zinc-900 rounded-xl border border-zinc-950 flex items-center justify-between hover:border-cyan-500/50 transition-all shadow cursor-pointer group"
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-white rounded shadow">
                      <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    </div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 group-hover:text-cyan-400 transition-colors">Instant QR Scan</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-950 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <button 
                  onClick={handleReturnButton}
                  className="text-[9px] bg-red-950/40 border border-red-900/40 hover:bg-red-900 hover:text-white text-red-400 font-bold px-2.5 py-1 rounded transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <span>CHANGE</span>
                </button>
                
                <div className="flex items-center space-x-1.5">
                  <button 
                    onClick={() => { setSoundOn(!soundOn); playSound('click'); }}
                    className={`p-1 rounded border transition-colors cursor-pointer ${
                      soundOn ? 'bg-zinc-750 border-zinc-700 text-zinc-200' : 'bg-red-950/30 border-red-900/20 text-red-400'
                    }`}
                    title="Audio Synthesizer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {soundOn ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm11.334-5.328L20.24 13m0 0l3.313 3.328m-3.313-3.328L16.92 16.33M20.24 13l3.313-3.328" />
                      )}
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => {
                      const themes = ['pink', 'cyan', 'yellow', 'white'];
                      const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
                      setCurrentTheme(themes[nextIdx]);
                      playSound('click');
                    }}
                    className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-750 text-zinc-200 text-[9px] font-bold cursor-pointer"
                  >
                    LED
                  </button>
                </div>
              </div>

              <div 
                onClick={collectReturnedCoins}
                className={`h-12 bg-zinc-950 rounded-xl border-t-4 border-zinc-900 shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)] flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
                  returnedCoins.length > 0 ? 'bg-zinc-900 cursor-pointer hover:border-yellow-600/40' : ''
                }`}
              >
                {returnedCoins.length > 0 ? (
                  <div className="flex flex-wrap gap-1 px-2 justify-center animate-bounce">
                    {returnedCoins.map((coinVal, idx) => (
                      <div 
                        key={idx} 
                        className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-[8px] text-zinc-950 font-extrabold flex items-center justify-center border border-yellow-200 shadow"
                        title={`Coin: ${VND(coinVal)}`}
                      >
                        $
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-700 font-extrabold tracking-widest uppercase">Refund Tray</span>
                )}
              </div>
            </div>

          </div>
        </div>
      );
    };

    ReactDOM.createRoot(document.getElementById('vending-machine-root')).render(<VendingSimulator />);
