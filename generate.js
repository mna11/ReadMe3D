const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!GITHUB_TOKEN || !USERNAME) {
    console.error('Error: GITHUB_TOKEN and USERNAME environment variables are required.');
    process.exit(1);
}

// 1. 데이터 가져오기 (기존과 동일)
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
    // 화면 레이아웃상 6~7개가 적당
    return allDays.slice(-6); 
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

// 2. SVG 생성 로직 (완전 개편)
function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // --- Isometric Math (그리드 시스템) ---
    const tileW = 32; // 타일 너비 (절반)
    const tileH = 16; // 타일 높이 (절반)
    const originX = width / 2;
    const originY = 100; // 화면 위쪽에서 시작

    // 그리드(x, y) -> 화면(screenX, screenY) 변환
    const iso = (gx, gy, gz = 0) => {
        return {
            x: originX + (gx - gy) * tileW,
            y: originY + (gx + gy) * tileH - gz
        };
    };

    // --- 그리기 헬퍼 함수 ---

    // 육면체(Block) 그리기 - 픽셀 아트 느낌의 외곽선과 단색 면
    const drawBlock = (gx, gy, gz, w, d, h, colors) => {
        const { x: px, y: py } = iso(gx, gy, gz);
        
        // 투영된 크기 계산 (근사치)
        // x, y 좌표는 iso 함수가 처리하므로, 여기서는 상대적인 크기만 계산
        const p_base = iso(gx, gy, gz);
        const p_right = iso(gx + w, gy, gz);
        const p_front = iso(gx, gy + d, gz);
        const p_top = iso(gx, gy, gz + h);

        // SVG Path 생성 (Pixel Perfect를 위해 좌표 정수화 권장되나 SVG라 생략)
        let svg = '';

        // Top Face
        const t1 = iso(gx, gy, gz + h);
        const t2 = iso(gx + w, gy, gz + h);
        const t3 = iso(gx + w, gy + d, gz + h);
        const t4 = iso(gx, gy + d, gz + h);
        svg += `<polygon points="${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y} ${t4.x},${t4.y}" fill="${colors.top}" stroke="${colors.stroke || 'none'}" stroke-width="1"/>`;

        // Right Face (Side)
        const r1 = t2;
        const r2 = t3;
        const r3 = iso(gx + w, gy + d, gz);
        const r4 = iso(gx + w, gy, gz);
        svg += `<polygon points="${r1.x},${r1.y} ${r2.x},${r2.y} ${r3.x},${r3.y} ${r4.x},${r4.y}" fill="${colors.right}" stroke="${colors.stroke || 'none'}" stroke-width="1"/>`;

        // Left Face (Front)
        const l1 = t4;
        const l2 = t3;
        const l3 = iso(gx + w, gy + d, gz);
        const l4 = iso(gx, gy + d, gz);
        svg += `<polygon points="${l1.x},${l1.y} ${l2.x},${l2.y} ${l3.x},${l3.y} ${l4.x},${l4.y}" fill="${colors.left}" stroke="${colors.stroke || 'none'}" stroke-width="1"/>`;

        return svg;
    };

    // 3D 텍스트 (복셀 스타일)
    const drawVoxelText = (text, startGx, startGy, startGz, color) => {
        let svg = '';
        let offset = 0;
        const scale = 0.15; // 텍스트 크기 조절

        for (const char of text.toUpperCase()) {
            const pattern = dotFont[char] || dotFont[' '];
            const width = pattern[0].length;

            for (let r = 0; r < pattern.length; r++) {
                for (let c = 0; c < pattern[r].length; c++) {
                    if (pattern[r][c]) {
                        // 글자를 세우기 위해: gy는 고정, gx는 가로, gz는 높이로 사용
                        // 화면을 바라보게 하기 위해 gx와 gy를 적절히 섞음
                        const gx = startGx + offset * scale + c * scale; 
                        const gy = startGy + offset * scale + c * scale; // 대각선 배치
                        const gz = startGz + (pattern.length - r) * scale * 20; // 높이
                        
                        // 작은 큐브 그리기
                        svg += drawBlock(gx, gy, gz, scale, scale, scale*20, {
                            top: color, right: '#111', left: color, stroke: 'none'
                        });
                    }
                }
            }
            offset += width + 1;
        }
        return svg;
    };


    // --- 렌더링 큐 (Painter's Algorithm) ---
    // 모든 객체를 리스트에 넣고 깊이(depth = gx + gy) 순서로 정렬하여 그립니다.
    let renderQueue = [];

    // 1. 잔디 (바닥) - 큰 다이아몬드
    renderQueue.push({
        depth: -100, // 가장 아래
        draw: () => {
            let s = '';
            // 잔디 베이스
            s += drawBlock(-2, -2, -2, 14, 14, 2, { top: '#2d4c1e', right: '#1a2e12', left: '#1f3815' });
            // 잔디 질감 (랜덤 픽셀)
            for(let i=0; i<30; i++) {
                const rx = Math.random() * 12 - 1;
                const ry = Math.random() * 12 - 1;
                s += drawBlock(rx, ry, 0, 0.2, 0.2, 0.1, { top: '#4ca64c', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 2. 도로 (잔디 위, 건물 앞)
    // 대각선으로 뻗은 도로
    renderQueue.push({
        depth: 20, // 건물보다 약간 앞쪽(또는 좌표에 따라 조정)
        draw: () => {
            // 도로 베이스 (-2, 9) ~ (9, -2) 대각선 방향으로 배치하고 싶음
            // 하지만 단순하게 오른쪽 하단 모서리를 따라 배치
            // 잔디가 (0,0)~(12,12)라면 도로는 (10,0)~(10,12) 라인
            let s = '';
            // 도로 블록을 여러개 이어 붙임 (곡선이나 경사를 위해)
            const roadColor = { top: '#333333', right: '#222222', left: '#2a2a2a' };
            
            // 도로: (10, -2) 에서 (10, 14) 까지 직선
            s += drawBlock(8, -2, 0, 4, 16, 0.1, roadColor);
            
            // 중앙선
            s += `<g opacity="0.7">`;
            for(let y=-1; y<14; y+=2) {
                s += drawBlock(9.8, y, 0.15, 0.4, 1, 0.05, { top: '#ffcc00', right: 'none', left: 'none' });
            }
            s += `</g>`;
            return s;
        }
    });

    // 3. 건물 및 데이터 객체 배치
    // 대각선: (0, 0) -> (6, 6) 방향으로 배치하면 서로 가리지 않고 잘 보임
    weekData.forEach((day, idx) => {
        const count = day.contributionCount;
        const gx = 1 + idx; // 1, 2, 3, 4...
        const gy = 1 + idx; // 1, 2, 3, 4... 대각선 배치
        
        // 깊이 계산 (Isometric에서 깊이는 x + y)
        const depth = gx + gy;

        renderQueue.push({
            depth: depth,
            draw: () => {
                let s = '';
                
                if (count === 0) {
                    // === 가로등 (앤티크 스타일) ===
                    const poleColor = { top: '#222', right: '#111', left: '#1a1a1a' };
                    // 기둥
                    s += drawBlock(gx+0.4, gy+0.4, 0, 0.2, 0.2, 60, poleColor);
                    // 램프 헤드
                    s += drawBlock(gx+0.1, gy+0.1, 60, 0.8, 0.8, 0.5, poleColor); // 받침
                    // 유리
                    s += drawBlock(gx+0.2, gy+0.2, 60.5, 0.6, 0.6, 12, { top: '#ffeba1', right: '#ffdd66', left: '#ffeeaa', stroke: '#ccaa44' });
                    // 지붕
                    s += drawBlock(gx, gy, 72.5, 1, 1, 2, poleColor);
                    s += drawBlock(gx+0.4, gy+0.4, 74.5, 0.2, 0.2, 3, poleColor); // 꼭대기 장식

                    // 빛 효과 (SVG Filter 대신 투명 폴리곤)
                    const center = iso(gx+0.5, gy+0.5, 66);
                    s += `<circle cx="${center.x}" cy="${center.y}" r="15" fill="#ffdd66" opacity="0.3" class="lamp-glow"/>`;

                    // 텍스트 (날짜)
                    s += drawVoxelText(dayNames[day.weekday], gx, gy, 85, '#8899aa');
                    s += drawVoxelText("0", gx+0.3, gy+0.3, 80, '#ffdd66');

                } else {
                    // === 건물 ===
                    const h = Math.min(150, 40 + count * 15);
                    const bColor = { top: '#6a7a8a', right: '#4a5a6a', left: '#5a6a7a', stroke: '#334455' };
                    
                    // 건물 본체
                    s += drawBlock(gx, gy, 0, 0.8, 0.8, h, bColor);

                    // 창문 (픽셀 느낌)
                    const winRows = Math.floor(h / 15);
                    for (let r = 1; r < winRows; r++) {
                        const wz = r * 15;
                        const isLit = Math.random() > 0.3;
                        const wColor = isLit ? '#ffdd66' : '#223344';
                        
                        // 왼쪽 면 창문
                        s += drawBlock(gx-0.05, gy+0.1, wz, 0.05, 0.2, 6, { top: wColor, right: wColor, left: wColor });
                        s += drawBlock(gx-0.05, gy+0.5, wz, 0.05, 0.2, 6, { top: wColor, right: wColor, left: wColor });

                        // 오른쪽 면 창문
                        s += drawBlock(gx+0.1, gy+0.85, wz, 0.2, 0.05, 6, { top: wColor, right: wColor, left: wColor });
                        s += drawBlock(gx+0.5, gy+0.85, wz, 0.2, 0.05, 6, { top: wColor, right: wColor, left: wColor });
                    }

                    // 텍스트 (날짜 및 개수)
                    s += drawVoxelText(dayNames[day.weekday], gx, gy, h + 20, '#8899aa');
                    s += drawVoxelText(count.toString(), gx, gy, h + 8, '#ffdd66');
                }
                return s;
            }
        });
    });

    // 4. 자동차 (도로 위)
    renderQueue.push({
        depth: 25, // 도로(20)보다 위, 건물 근처
        draw: () => {
            let s = '';
            // 차 1
            const cx = 9; const cy = 2;
            const carColor = { top: '#4a90e2', right: '#357abd', left: '#5a9de2' };
            s += drawBlock(cx, cy, 0.5, 1.5, 3, 8, carColor); // 몸통
            s += drawBlock(cx+0.2, cy+0.5, 8.5, 1.1, 1.5, 5, { top: '#222', right: '#222', left: '#222' }); // 창문/지붕
            // 헤드라이트
            s += drawBlock(cx+0.2, cy-0.1, 2, 0.3, 0.1, 2, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            s += drawBlock(cx+1.0, cy-0.1, 2, 0.3, 0.1, 2, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            return s;
        }
    });

    // --- 정렬 및 렌더링 실행 ---
    renderQueue.sort((a, b) => a.depth - b.depth);

    let objectsSvg = '';
    renderQueue.forEach(obj => {
        objectsSvg += obj.draw();
    });


    // --- 배경 요소 ---
    let stars = '';
    for (let i = 0; i < 60; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.6;
        const r = Math.random() * 1.5;
        const delay = Math.random() * 3;
        stars += `<rect x="${sx}" y="${sy}" width="${r*2}" height="${r*2}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    // --- 최종 SVG 조합 ---
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0f0f1a"/>
                <stop offset="100%" stop-color="#2a2a3a"/>
            </linearGradient>
            <style>
                @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes lampPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
                .star { animation: twinkle 3s infinite; }
                .lamp-glow { animation: lampPulse 4s infinite; }
            </style>
        </defs>
        
        <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
        ${stars}
        
        <g transform="translate(800, 80)">
             <rect x="-20" y="-20" width="40" height="40" fill="#fff9c4"/>
             <rect x="-25" y="-10" width="5" height="20" fill="#fff9c4"/>
             <rect x="20" y="-10" width="5" height="20" fill="#fff9c4"/>
             <rect x="-10" y="-25" width="20" height="5" fill="#fff9c4"/>
             <rect x="-10" y="20" width="20" height="5" fill="#fff9c4"/>
             <rect x="-10" y="-5" width="8" height="8" fill="#e6ee9c" opacity="0.5"/>
        </g>

        <g transform="translate(0, 50)">
            ${objectsSvg}
        </g>

        <g font-family="'Courier New', monospace" font-weight="bold">
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28" stroke="#000" stroke-width="4" paint-order="stroke">CONTRIBUTION CITY</text>
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28">CONTRIBUTION CITY</text>
            
            <text x="30" y="${height - 50}" fill="#fff" font-size="18">TOTAL: <tspan fill="#ffdd66">${totalContributions}</tspan></text>
            <text x="30" y="${height - 25}" fill="#fff" font-size="18">TODAY: <tspan fill="#ffdd66">${weekData[weekData.length-1].contributionCount}</tspan></text>
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
        console.log('Last 6 days data:', weekData.map(d => `${d.date}: ${d.contributionCount}`).join(', '));
        
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