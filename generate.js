const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!GITHUB_TOKEN || !USERNAME) {
    console.error('Error: GITHUB_TOKEN and USERNAME environment variables are required.');
    process.exit(1);
}

// 1. 데이터 가져오기
async function fetchContributions() {
    const query = `
    query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    totalContributions
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                            weekday
                        }
                    }
                }
            }
        }
    }`;

    const body = JSON.stringify({
        query,
        variables: { username: USERNAME }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'contribution-city-generator'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.errors) {
                        reject(new Error(JSON.stringify(json.errors)));
                    } else {
                        resolve(json.data.user.contributionsCollection.contributionCalendar);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function getLastWeekData(calendar) {
    const allDays = calendar.weeks.flatMap(w => w.contributionDays);
    return allDays.slice(-7);
}

// --- 도트 폰트 데이터 (5x7) ---
const dotFont = {
    '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    '2': [[1,1,1],[0,0,1],[0,0,1],[1,1,1],[1,0,0],[1,0,0],[1,1,1]],
    '3': [[1,1,1],[0,0,1],[0,0,1],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    '4': [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1],[0,0,1]],
    '5': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    '6': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,1],[1,0,1],[1,1,1]],
    '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    '8': [[1,1,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,1,1]],
    '9': [[1,1,1],[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    'S': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    'U': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1]],
    'M': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1]],
    'O': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    'W': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,1,1],[1,0,1]],
    'E': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,0],[1,0,0],[1,1,1]],
    'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
    'H': [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    'F': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,0],[1,0,0],[1,0,0]],
    'R': [[1,1,0],[1,0,1],[1,0,1],[1,1,0],[1,0,1],[1,0,1],[1,0,1]],
    'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    'A': [[0,1,0],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    'Y': [[1,0,1],[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    ' ': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]
};

// SVG 생성 로직
function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // --- 좌표계 설정 ---
    // 전체 씬을 화면 중앙에 맞춤
    const tileW = 34;
    const tileH = 17;
    const originX = 250; 
    const originY = 200; 

    // 등각투영 변환
    const iso = (gx, gy, gz = 0) => {
        return {
            x: originX + (gx - gy) * tileW,
            y: originY + (gx + gy) * tileH - gz
        };
    };

    // --- 헬퍼: 큐브(Block) 그리기 ---
    const drawBlock = (gx, gy, gz, w, d, h, colors) => {
        const p0 = iso(gx, gy, gz + h);          // Top-Back-Left
        const p1 = iso(gx + w, gy, gz + h);      // Top-Back-Right
        const p2 = iso(gx + w, gy + d, gz + h);  // Top-Front-Right
        const p3 = iso(gx, gy + d, gz + h);      // Top-Front-Left
        const p4 = iso(gx + w, gy + d, gz);      // Bottom-Front-Right
        const p5 = iso(gx, gy + d, gz);          // Bottom-Front-Left
        const p6 = iso(gx + w, gy, gz);          // Bottom-Back-Right

        let svg = '';
        // 윗면 (Top)
        svg += `<polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="${colors.top}"/>`;
        // 오른쪽면 (Right) - 빛을 받는 면
        svg += `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p4.x},${p4.y} ${p6.x},${p6.y}" fill="${colors.right}"/>`;
        // 왼쪽면 (Left) - 그림자 지는 면
        svg += `<polygon points="${p3.x},${p3.y} ${p2.x},${p2.y} ${p4.x},${p4.y} ${p5.x},${p5.y}" fill="${colors.left}"/>`;
        return svg;
    };

    // --- 텍스트 그리기 (Voxel Text) ---
    const drawVoxelText = (text, startGx, startGy, startGz, color, scale = 0.1) => {
        let svg = '';
        let offset = 0;
        
        for (const char of text.toUpperCase()) {
            const pattern = dotFont[char] || dotFont[' '];
            const charW = pattern[0].length;
            
            for (let r = 0; r < pattern.length; r++) {
                for (let c = 0; c < pattern[r].length; c++) {
                    if (pattern[r][c]) {
                        // 텍스트 배치: 정면을 바라보도록 설정
                        const vx = startGx + (offset + c) * scale * 2; 
                        const vy = startGy;
                        const vz = startGz + (pattern.length - r) * scale * 25;

                        svg += drawBlock(vx, vy, vz, scale*2, scale, scale*25, {
                            top: color, right: '#111', left: color
                        });
                    }
                }
            }
            offset += charW + 1;
        }
        return svg;
    };


    // --- 렌더링 큐 (Painter's Algorithm) ---
    // depth(깊이)가 작은 순서대로 그려야 함 (멀리 있는 것 -> 가까이 있는 것)
    // Isometric에서 깊이는 (gx + gy) 값이 작을수록 화면 위쪽(뒤쪽)임
    let renderQueue = [];

    // 레이아웃 구성:
    // 1. 상단 잔디 (뒤쪽, 건물 아래) : gy = -4 ~ 0
    // 2. 도로 (중앙) : gy = 2 ~ 6
    // 3. 하단 잔디 (앞쪽) : gy = 8 ~ 12
    // 건물 배치: gy = -1 (상단 잔디 위)

    // 1. 상단 잔디 (건물 받침)
    renderQueue.push({
        depth: -200,
        draw: () => {
            let s = '';
            const grassColor = { top: '#1b3a1b', right: '#102210', left: '#152b15' };
            // gx 넓게, gy는 위쪽 영역
            s += drawBlock(-6, -4, 0, 22, 5, 1.0, grassColor);
            
            // 디테일
            for(let i=0; i<40; i++) {
                const rx = -5 + Math.random() * 20;
                const ry = -3.5 + Math.random() * 4;
                s += drawBlock(rx, ry, 1.0, 0.1, 0.1, 0.2, { top: '#4ca64c', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 2. 도로 (중앙)
    renderQueue.push({
        depth: -100,
        draw: () => {
            let s = '';
            const roadColor = { top: '#333333', right: '#222222', left: '#2a2a2a' };
            // gy를 2부터 시작해서 도로 배치
            s += drawBlock(-8, 2, 0, 26, 6, 0.2, roadColor);
            
            // 중앙선
            for (let x = -6; x < 18; x += 2) {
                s += drawBlock(x, 4.8, 0.25, 1, 0.4, 0.05, { top: '#ffcc00', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 3. 하단 잔디 (앞쪽)
    renderQueue.push({
        depth: 50,
        draw: () => {
            let s = '';
            const grassColor = { top: '#152b15', right: '#0d1a0d', left: '#102010' };
            s += drawBlock(-8, 9, -0.5, 26, 5, 1.0, grassColor);
            return s;
        }
    });

    // 4. 건물 및 데이터 객체 (상단 잔디 위 배치)
    weekData.forEach((day, idx) => {
        const count = day.contributionCount;
        
        // 배치: 상단 잔디 위 (gy = -1 근처)
        const gx = idx * 1.8; 
        const gy = -1; 
        
        const depth = gx + gy; 

        renderQueue.push({
            depth: depth,
            draw: () => {
                let s = '';
                
                if (count === 0) {
                    // === 가로등 ===
                    const poleColor = { top: '#1a1a1a', right: '#000000', left: '#111111' };
                    // 기둥
                    s += drawBlock(gx+0.4, gy+0.4, 1.0, 0.2, 0.2, 55, poleColor);
                    // 헤드
                    s += drawBlock(gx+0.25, gy+0.25, 56.0, 0.5, 0.5, 2, poleColor);
                    
                    const glassColor = { top: '#fffde8', right: '#fff176', left: '#ffee58' };
                    s += drawBlock(gx+0.3, gy+0.3, 58.0, 0.4, 0.4, 8, glassColor);
                    
                    s += drawBlock(gx+0.2, gy+0.2, 66.0, 0.6, 0.6, 1.5, poleColor);
                    s += drawBlock(gx+0.35, gy+0.35, 67.5, 0.3, 0.3, 4, poleColor);

                    // 바닥 깜빡임 제거됨 (요청사항 반영)
                    
                    // 텍스트: 요일은 기둥 위, 숫자는 그 위
                    s += drawVoxelText(dayNames[day.weekday], gx-0.1, gy, 75, '#8899aa', 0.08); // scale 줄임
                    s += drawVoxelText('0', gx+0.3, gy, 64, '#ffdd66', 0.1); 
                } else {
                    // === 건물 ===
                    const h = Math.min(150, 35 + count * 8);
                    const bColor = { top: '#5a5a4a', right: '#3a3a2a', left: '#4a4a3a' };
                    
                    // 건물 본체
                    s += drawBlock(gx, gy, 1.0, 1.2, 1.2, h, bColor);

                    // 창문 (우측면 = Right Face = gx + width 면)
                    const winRows = Math.floor(h / 15);
                    for (let r = 1; r < winRows; r++) {
                        const wz = 1.0 + r * 15;
                        if (wz > h - 10) continue;
                        
                        const isLit = Math.random() > 0.3;
                        const wColor = isLit 
                            ? { top: '#fdd835', right: '#fbc02d', left: '#ffeb3b' }
                            : { top: '#1a1a15', right: '#151510', left: '#181815' };
                        
                        // 우측면 창문 (Right Face)
                        // gx 좌표: gx + 1.2 (건물 너비)
                        // gy 좌표: gy + 0.2 ~ 1.0 사이 (건물 깊이 내)
                        s += drawBlock(gx + 1.2, gy + 0.2, wz, 0.1, 0.3, 8, wColor); // 앞쪽 창문
                        s += drawBlock(gx + 1.2, gy + 0.7, wz, 0.1, 0.3, 8, wColor); // 뒤쪽 창문
                    }

                    // 텍스트 라벨 (겹치지 않게 높이 조정 및 크기 축소)
                    // 요일을 더 높게, 숫자를 건물 바로 위로
                    s += drawVoxelText(dayNames[day.weekday], gx-0.1, gy, h + 22, '#90a4ae', 0.08); // Scale 0.08
                    s += drawVoxelText(count.toString(), gx+0.2, gy+0.2, h + 5, '#ffdd66', 0.1); 
                }
                return s;
            }
        });
    });

    // 5. 자동차 (도로 위)
    renderQueue.push({
        depth: -20, // 도로 위, 건물 앞쪽
        draw: () => {
            let s = '';
            // 도로 gy가 2~6이므로, 차는 gy=3.5 정도에 배치
            const cx = -3; 
            const cy = 3.5; 
            const cz = 0.3;
            
            // 차체
            s += drawBlock(cx, cy, cz, 2.8, 1.2, 2.5, { top: '#42a5f5', right: '#1e88e5', left: '#2196f3' });
            // 지붕
            s += drawBlock(cx+0.5, cy+0.1, cz+2.5, 1.8, 1.0, 1.5, { top: '#222', right: '#111', left: '#1a1a1a' });
            // 헤드라이트 (오른쪽 면)
            s += drawBlock(cx+2.7, cy+0.2, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            s += drawBlock(cx+2.7, cy+0.7, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            
            return s;
        }
    });

    // --- 정렬 및 그리기 ---
    renderQueue.sort((a, b) => a.depth - b.depth);

    let objectsSvg = '';
    renderQueue.forEach(obj => {
        objectsSvg += obj.draw();
    });

    // --- 배경 장식 ---
    let stars = '';
    for (let i = 0; i < 60; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.55;
        const r = Math.random() * 1.5 + 0.5;
        const delay = (Math.random() * 3).toFixed(1);
        stars += `<rect x="${sx}" y="${sy}" width="${r * 2}" height="${r * 2}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    const todayContributions = weekData[weekData.length - 1].contributionCount;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1026"/>
      <stop offset="100%" stop-color="#2b3266"/>
    </linearGradient>
    <style>
      @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      .star { animation: twinkle 3s infinite; }
    </style>
  </defs>
  
  <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
  
  ${stars}
  
  <circle cx="800" cy="80" r="40" fill="#fffde8" opacity="0.15"/>
  <circle cx="800" cy="80" r="30" fill="#fffee8"/>
  <circle cx="792" cy="74" r="5" fill="#eeeedd" opacity="0.5"/>
  
  ${objectsSvg}
  
  <text x="${width / 2}" y="50" text-anchor="middle" fill="#fff" font-family="'Courier New', monospace" font-size="28" font-weight="bold" stroke="#000" stroke-width="4" paint-order="stroke">CONTRIBUTION CITY</text>
  <text x="${width / 2}" y="50" text-anchor="middle" fill="#fff" font-family="'Courier New', monospace" font-size="28" font-weight="bold">CONTRIBUTION CITY</text>
  
  <text x="30" y="${height - 50}" fill="#cfd8dc" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TOTAL: <tspan fill="#fdd835">${totalContributions}</tspan></text>
  <text x="30" y="${height - 28}" fill="#cfd8dc" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TODAY: <tspan fill="#fdd835">${todayContributions}</tspan></text>
</svg>`;

    return svg;
}

async function main() {
    try {
        console.log(`Fetching contributions for ${USERNAME}...`);
        const calendar = await fetchContributions();
        console.log(`Total contributions: ${calendar.totalContributions}`);
        const weekData = getLastWeekData(calendar);
        console.log('Last 7 days:', weekData.map(d => `${d.date}: ${d.contributionCount}`).join(', '));
        const svg = generateSVG(weekData, calendar.totalContributions);
        const outputDir = 'profile-3d-contrib';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        fs.writeFileSync(`${outputDir}/contribution-city.svg`, svg);
        console.log(`Generated: ${outputDir}/contribution-city.svg`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();