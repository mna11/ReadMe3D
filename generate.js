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

    // --- 좌표계 설정 (Isometric) ---
    // image_45d078.png 배치 참고:
    // 도로가 뒤쪽(gy 작음)에 있고, 건물이 앞쪽(gy 큼)에 있음.
    // gx가 증가할수록 오른쪽 아래로 뻗어나가는 형태.
    
    const tileW = 34;
    const tileH = 17;
    const originX = 150; // 시작점 (화면 왼쪽)
    const originY = 300; // 시작점 (화면 중간)

    const iso = (gx, gy, gz = 0) => {
        return {
            x: originX + (gx - gy) * tileW,
            y: originY + (gx + gy) * tileH - gz
        };
    };

    // --- 그리기 헬퍼: 솔리드 큐브 (Voxel) ---
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
    const drawVoxelText = (text, startGx, startGy, startGz, color) => {
        let svg = '';
        let offset = 0;
        const scale = 0.12;

        for (const char of text.toUpperCase()) {
            const pattern = dotFont[char] || dotFont[' '];
            const charW = pattern[0].length;
            
            for (let r = 0; r < pattern.length; r++) {
                for (let c = 0; c < pattern[r].length; c++) {
                    if (pattern[r][c]) {
                        // 텍스트를 정면을 바라보게 세움
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
    let renderQueue = [];

    // 1. 도로 (뒤쪽 배경 역할)
    // Grid: gy = -3 라인 (건물보다 뒤)
    renderQueue.push({
        depth: -100,
        draw: () => {
            let s = '';
            const roadColor = { top: '#333333', right: '#222222', left: '#2a2a2a' };
            // gx를 길게 뻗어서 화면 가로지르기
            s += drawBlock(-5, -3, 0, 20, 3, 0.2, roadColor);
            
            // 중앙선 (노란 점선)
            for (let x = -4; x < 15; x += 2) {
                s += drawBlock(x, -1.5, 0.25, 1, 0.2, 0.05, { top: '#ffcc00', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 2. 잔디 (앞쪽 채움)
    // Grid: gy = -1 부터 화면 앞쪽까지
    renderQueue.push({
        depth: -50,
        draw: () => {
            let s = '';
            const grassColor = { top: '#1b3a1b', right: '#102210', left: '#152b15' }; // 조금 더 어두운 톤
            s += drawBlock(-5, 0, 0, 20, 8, 1.5, grassColor); // 두께감 있는 바닥
            
            // 잔디 디테일 (랜덤 픽셀)
            for(let i=0; i<60; i++) {
                const rx = -4 + Math.random() * 18;
                const ry = 0.5 + Math.random() * 7;
                s += drawBlock(rx, ry, 1.5, 0.15, 0.15, 0.15, { top: '#4ca64c', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 3. 건물 및 데이터 객체 (도로 바로 앞, 잔디 위)
    weekData.forEach((day, idx) => {
        const count = day.contributionCount;
        
        // 배치: gy = 1 (잔디 위), gx는 증가 (왼쪽 -> 오른쪽)
        const gx = idx * 1.8; // 간격
        const gy = 1; 
        
        const depth = gx + gy; // 깊이 정렬 키

        renderQueue.push({
            depth: depth,
            draw: () => {
                let s = '';
                
                if (count === 0) {
                    // === 가로등 (앤티크 Voxel) ===
                    const poleColor = { top: '#1a1a1a', right: '#000000', left: '#111111' };
                    // 기둥
                    s += drawBlock(gx+0.35, gy+0.35, 1.5, 0.3, 0.3, 50, poleColor);
                    // 헤드 부분
                    s += drawBlock(gx+0.2, gy+0.2, 51.5, 0.6, 0.6, 1, poleColor);
                    
                    // 불빛 (유리)
                    const glassColor = { top: '#fff9c4', right: '#fff176', left: '#ffee58' };
                    s += drawBlock(gx+0.25, gy+0.25, 52.5, 0.5, 0.5, 10, glassColor);
                    
                    // 지붕
                    s += drawBlock(gx+0.15, gy+0.15, 62.5, 0.7, 0.7, 2, poleColor);
                    s += drawBlock(gx+0.4, gy+0.4, 64.5, 0.2, 0.2, 3, poleColor);

                    // 바닥 빛 번짐
                    const center = iso(gx+0.5, gy+0.5, 1.6);
                    s += `<circle cx="${center.x}" cy="${center.y}" r="22" fill="#fff176" opacity="0.1" class="lamp-glow"/>`;

                    // 요일 라벨
                    s += drawVoxelText(dayNames[day.weekday], gx-0.1, gy-0.5, 75, '#90a4ae');

                } else {
                    // === 건물 (Contribution Tower) ===
                    const h = Math.min(140, 30 + count * 12);
                    const bColor = { top: '#546e7a', right: '#37474f', left: '#455a64' }; // 차분한 블루그레이
                    
                    // 건물 본체
                    s += drawBlock(gx, gy, 1.5, 1.0, 1.0, h, bColor);

                    // 창문 생성
                    const winRows = Math.floor(h / 12);
                    for (let r = 1; r < winRows; r++) {
                        const wz = 1.5 + r * 12;
                        const isLit = Math.random() > 0.3; // 불 켜질 확률
                        const wColor = isLit ? { top: '#ffeb3b', right: '#fdd835', left: '#fff176' } 
                                             : { top: '#263238', right: '#102027', left: '#1c262b' };
                        
                        // 정면(왼쪽면) 창문
                        s += drawBlock(gx-0.05, gy+0.1, wz, 0.1, 0.3, 5, wColor);
                        s += drawBlock(gx-0.05, gy+0.6, wz, 0.1, 0.3, 5, wColor);
                        
                        // 측면(오른쪽면) 창문
                        s += drawBlock(gx+0.1, gy+0.95, wz, 0.3, 0.1, 5, wColor);
                        s += drawBlock(gx+0.6, gy+0.95, wz, 0.3, 0.1, 5, wColor);
                    }

                    // 텍스트 라벨 (요일, 개수)
                    // 건물 위에 띄움
                    s += drawVoxelText(dayNames[day.weekday], gx-0.1, gy, h + 15, '#b0bec5');
                    s += drawVoxelText(count.toString(), gx+0.3, gy+0.2, h + 5, '#fdd835');
                }
                return s;
            }
        });
    });

    // 4. 자동차 (도로 위 - 건물 뒤쪽으로 지나감)
    renderQueue.push({
        depth: -80, // 잔디(-50)보다 뒤, 도로(-100)보다 앞
        draw: () => {
            let s = '';
            const cx = 2; // 도로 상의 위치
            const cy = -2; // 도로 위치 (gy = -2 ~ -3)
            const cz = 0.2;
            
            // 차체 (파란색 스포츠카 느낌)
            s += drawBlock(cx, cy, cz, 2.5, 1.2, 3, { top: '#29b6f6', right: '#0288d1', left: '#03a9f4' });
            // 지붕
            s += drawBlock(cx+0.5, cy+0.1, cz+3, 1.5, 1, 2, { top: '#111', right: '#111', left: '#111' });
            // 헤드라이트
            s += drawBlock(cx+2.4, cy+0.2, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            s += drawBlock(cx+2.4, cy+0.7, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            
            return s;
        }
    });

    // --- 정렬 및 그리기 (Painter's Algorithm) ---
    renderQueue.sort((a, b) => a.depth - b.depth);

    let objectsSvg = '';
    renderQueue.forEach(obj => {
        objectsSvg += obj.draw();
    });

    // --- 배경 장식 ---
    let stars = '';
    for (let i = 0; i < 50; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.6;
        const r = Math.random() * 1.5;
        const delay = Math.random() * 3;
        stars += `<rect x="${sx}" y="${sy}" width="${r*2}" height="${r*2}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0f172a"/>
                <stop offset="100%" stop-color="#1e293b"/>
            </linearGradient>
            <style>
                @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
                @keyframes lampPulse { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.25; } }
                .star { animation: twinkle 3s infinite; }
                .lamp-glow { animation: lampPulse 4s infinite; }
            </style>
        </defs>
        
        <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
        ${stars}
        
        <g transform="translate(800, 70)">
             <rect x="-20" y="-20" width="40" height="40" fill="#fff9c4"/>
             <rect x="-25" y="-10" width="5" height="20" fill="#fff9c4"/>
             <rect x="20" y="-10" width="5" height="20" fill="#fff9c4"/>
             <rect x="-10" y="-25" width="20" height="5" fill="#fff9c4"/>
             <rect x="-10" y="20" width="20" height="5" fill="#fff9c4"/>
             <rect x="-10" y="-5" width="8" height="8" fill="#e6ee9c" opacity="0.6"/>
        </g>

        <g transform="translate(0, 50)">
            ${objectsSvg}
        </g>

        <g font-family="'Courier New', monospace" font-weight="bold">
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28" stroke="#000" stroke-width="4" paint-order="stroke">CONTRIBUTION CITY</text>
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28">CONTRIBUTION CITY</text>
            
            <text x="30" y="${height - 50}" fill="#cfd8dc" font-size="16">TOTAL: <tspan fill="#fdd835">${totalContributions}</tspan></text>
            <text x="30" y="${height - 25}" fill="#cfd8dc" font-size="16">TODAY: <tspan fill="#fdd835">${weekData[weekData.length-1].contributionCount}</tspan></text>
        </g>
    </svg>`;

    return svg;
}

// 3. 실행 함수
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