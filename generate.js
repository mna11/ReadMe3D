const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

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

// 도트 폰트 (3x5 간단 버전)
const dotFont = {
    '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
    '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
    '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
    '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
    '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
    '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
    '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
    'M': [[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    'O': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
    'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    'U': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'E': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
    'W': [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1]],
    'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
    'H': [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    'F': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
    'R': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    'S': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    'Y': [[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
    'C': [[1,1,1],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    ':': [[0],[1],[0],[1],[0]],
    ' ': [[0,0],[0,0],[0,0],[0,0],[0,0]]
};

// 2D 도트 텍스트
function drawDotText2D(text, startX, startY, pixelSize, color) {
    let svg = '';
    let offsetX = 0;
    
    for (const char of text.toUpperCase()) {
        const pattern = dotFont[char] || dotFont[' '];
        const charWidth = pattern[0].length;
        
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < pattern[row].length; col++) {
                if (pattern[row][col]) {
                    const px = startX + (offsetX + col) * pixelSize;
                    const py = startY + row * pixelSize;
                    svg += `<rect x="${px}" y="${py}" width="${pixelSize * 0.9}" height="${pixelSize * 0.9}" fill="${color}"/>`;
                }
            }
        }
        offsetX += charWidth + 1;
    }
    return svg;
}

// 등각투영 도트 텍스트
function drawIsoDotText(text, baseX, baseY, baseZ, pixelSize, color, isoX, isoY) {
    let svg = '';
    let offsetX = 0;
    
    for (const char of text.toUpperCase()) {
        const pattern = dotFont[char] || dotFont[' '];
        const charWidth = pattern[0].length;
        
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < pattern[row].length; col++) {
                if (pattern[row][col]) {
                    const x = baseX + (offsetX + col) * pixelSize;
                    const z = baseZ - row * pixelSize;
                    
                    const cx = isoX(x, baseY);
                    const cy = isoY(x, baseY, z);
                    const s = pixelSize * 0.45;
                    
                    // 등각투영 마름모
                    svg += `<polygon points="${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}" fill="${color}"/>`;
                }
            }
        }
        offsetX += charWidth + 1;
    }
    return svg;
}

function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    
    // 등각투영 함수 (참고 이미지처럼 오른쪽 위로 올라가는 방향)
    const isoX = (x, y) => x * 0.8 - y * 0.5;
    const isoY = (x, y, z) => x * 0.3 + y * 0.6 - z;
    
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let elements = '';
    let stars = '';
    
    // 별
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 160;
        const r = Math.random() * 1.5 + 0.5;
        const delay = (Math.random() * 3).toFixed(1);
        stars += `<circle class="star" cx="${x}" cy="${y}" r="${r}" fill="white" style="animation-delay: ${delay}s"/>`;
    }
    
    const todayContributions = weekData[weekData.length - 1].contributionCount;
    
    // 오프셋
    const offsetX = 120;
    const offsetY = 180;
    
    // 도로 (대각선)
    const roadY = 250;
    elements += `
        <polygon points="
            ${offsetX + isoX(-50, roadY)},${offsetY + isoY(-50, roadY, 0)}
            ${offsetX + isoX(650, roadY)},${offsetY + isoY(650, roadY, 0)}
            ${offsetX + isoX(650, roadY + 50)},${offsetY + isoY(650, roadY + 50, 0)}
            ${offsetX + isoX(-50, roadY + 50)},${offsetY + isoY(-50, roadY + 50, 0)}
        " fill="#2a2a2a"/>
        <line 
            x1="${offsetX + isoX(0, roadY + 25)}" 
            y1="${offsetY + isoY(0, roadY + 25, 0)}" 
            x2="${offsetX + isoX(600, roadY + 25)}" 
            y2="${offsetY + isoY(600, roadY + 25, 0)}" 
            stroke="#ffff66" stroke-width="2" stroke-dasharray="15,12" opacity="0.7"/>
    `;
    
    // 잔디 (위쪽 - 건물 뒤)
    elements += `
        <polygon points="
            0,0
            ${width},0
            ${width},${offsetY + isoY(700, roadY, 0)}
            ${offsetX + isoX(700, roadY)},${offsetY + isoY(700, roadY, 0)}
            ${offsetX + isoX(-100, roadY)},${offsetY + isoY(-100, roadY, 0)}
            0,${offsetY + isoY(-100, roadY, 0)}
        " fill="#2d4d2d"/>
    `;
    
    // 잔디 (아래쪽 - 도로 뒤)
    elements += `
        <polygon points="
            0,${height}
            ${width},${height}
            ${width},${offsetY + isoY(700, roadY + 50, 0)}
            ${offsetX + isoX(700, roadY + 50)},${offsetY + isoY(700, roadY + 50, 0)}
            ${offsetX + isoX(-100, roadY + 50)},${offsetY + isoY(-100, roadY + 50, 0)}
            0,${offsetY + isoY(-100, roadY + 50, 0)}
        " fill="#1a3a1a"/>
    `;
    
    // 건물 설정
    const buildingWidth = 55;
    const buildingDepth = 40;
    const spacing = 80;
    const maxHeight = 160;
    const buildingY = roadY - buildingDepth - 10; // 도로 위쪽
    
    // 건물 그리기 (오른쪽부터 - 뒤에서 앞으로)
    for (let i = 6; i >= 0; i--) {
        const day = weekData[i];
        const count = day.contributionCount;
        const bx = i * spacing;
        const by = buildingY;
        
        if (count === 0) {
            // 가로등
            const lampCx = offsetX + isoX(bx + buildingWidth/2, by + buildingDepth/2);
            const lampBase = offsetY + isoY(bx + buildingWidth/2, by + buildingDepth/2, 0);
            const lampTop = offsetY + isoY(bx + buildingWidth/2, by + buildingDepth/2, 70);
            
            elements += `
                <g class="lamp">
                    <rect x="${lampCx - 2}" y="${lampTop}" width="4" height="${lampBase - lampTop}" fill="#444"/>
                    <ellipse cx="${lampCx}" cy="${lampTop - 4}" rx="10" ry="5" fill="#333"/>
                    <ellipse class="lamp-glow" cx="${lampCx}" cy="${lampTop - 2}" rx="15" ry="8" fill="#ffdd44" opacity="0.5"/>
                    <ellipse cx="${lampCx}" cy="${lampTop - 3}" rx="6" ry="3" fill="#ffeedd"/>
                    <polygon points="${lampCx - 10},${lampTop} ${lampCx + 10},${lampTop} ${lampCx + 18},${lampBase - 10} ${lampCx - 18},${lampBase - 10}" fill="#ffdd44" opacity="0.08"/>
                </g>
            `;
            
            // 라벨
            const labelX = lampCx - 12;
            const labelY = lampTop - 30;
            elements += drawDotText2D(dayNames[day.weekday], labelX, labelY, 3, '#8899bb');
            elements += drawDotText2D(count.toString(), labelX + 4, labelY + 18, 4, '#ffdd66');
            
        } else {
            // 건물 높이
            const bHeight = Math.max(40, (count / 20) * maxHeight);
            
            // 건물 꼭지점
            const p = {
                // 바닥
                f1: { x: offsetX + isoX(bx, by), y: offsetY + isoY(bx, by, 0) },
                f2: { x: offsetX + isoX(bx + buildingWidth, by), y: offsetY + isoY(bx + buildingWidth, by, 0) },
                f3: { x: offsetX + isoX(bx + buildingWidth, by + buildingDepth), y: offsetY + isoY(bx + buildingWidth, by + buildingDepth, 0) },
                f4: { x: offsetX + isoX(bx, by + buildingDepth), y: offsetY + isoY(bx, by + buildingDepth, 0) },
                // 지붕
                t1: { x: offsetX + isoX(bx, by), y: offsetY + isoY(bx, by, bHeight) },
                t2: { x: offsetX + isoX(bx + buildingWidth, by), y: offsetY + isoY(bx + buildingWidth, by, bHeight) },
                t3: { x: offsetX + isoX(bx + buildingWidth, by + buildingDepth), y: offsetY + isoY(bx + buildingWidth, by + buildingDepth, bHeight) },
                t4: { x: offsetX + isoX(bx, by + buildingDepth), y: offsetY + isoY(bx, by + buildingDepth, bHeight) }
            };
            
            // 창문
            let windows = '';
            const winRows = Math.floor((bHeight - 15) / 22);
            const winCols = 3;
            
            // 정면 창문 (도로쪽 - by + buildingDepth 면)
            for (let row = 0; row < winRows; row++) {
                for (let col = 0; col < winCols; col++) {
                    const wz = bHeight - 12 - row * 22;
                    if (wz < 10) continue;
                    
                    const wx1 = bx + 8 + col * 16;
                    const wx2 = wx1 + 10;
                    const wy = by + buildingDepth;
                    
                    const isLit = Math.random() > 0.2;
                    const glowColor = isLit ? '#ffdd55' : '#181818';
                    
                    const wp1 = { x: offsetX + isoX(wx1, wy), y: offsetY + isoY(wx1, wy, wz) };
                    const wp2 = { x: offsetX + isoX(wx2, wy), y: offsetY + isoY(wx2, wy, wz) };
                    const wp3 = { x: offsetX + isoX(wx2, wy), y: offsetY + isoY(wx2, wy, wz - 14) };
                    const wp4 = { x: offsetX + isoX(wx1, wy), y: offsetY + isoY(wx1, wy, wz - 14) };
                    
                    windows += `<polygon class="window" points="${wp1.x},${wp1.y} ${wp2.x},${wp2.y} ${wp3.x},${wp3.y} ${wp4.x},${wp4.y}" fill="${glowColor}"/>`;
                }
            }
            
            // 오른쪽 면 창문
            for (let row = 0; row < winRows; row++) {
                for (let col = 0; col < 2; col++) {
                    const wz = bHeight - 12 - row * 22;
                    if (wz < 10) continue;
                    
                    const wx = bx + buildingWidth;
                    const wy1 = by + 8 + col * 16;
                    const wy2 = wy1 + 10;
                    
                    const isLit = Math.random() > 0.2;
                    const glowColor = isLit ? '#ddbb44' : '#151515';
                    
                    const wp1 = { x: offsetX + isoX(wx, wy1), y: offsetY + isoY(wx, wy1, wz) };
                    const wp2 = { x: offsetX + isoX(wx, wy2), y: offsetY + isoY(wx, wy2, wz) };
                    const wp3 = { x: offsetX + isoX(wx, wy2), y: offsetY + isoY(wx, wy2, wz - 14) };
                    const wp4 = { x: offsetX + isoX(wx, wy1), y: offsetY + isoY(wx, wy1, wz - 14) };
                    
                    windows += `<polygon class="window" points="${wp1.x},${wp1.y} ${wp2.x},${wp2.y} ${wp3.x},${wp3.y} ${wp4.x},${wp4.y}" fill="${glowColor}"/>`;
                }
            }
            
            // 건물 본체
            elements += `
                <g class="building">
                    <!-- 왼쪽 면 -->
                    <polygon points="${p.f1.x},${p.f1.y} ${p.t1.x},${p.t1.y} ${p.t4.x},${p.t4.y} ${p.f4.x},${p.f4.y}" fill="#3a3a2a"/>
                    <!-- 정면 (도로쪽) -->
                    <polygon points="${p.f4.x},${p.f4.y} ${p.t4.x},${p.t4.y} ${p.t3.x},${p.t3.y} ${p.f3.x},${p.f3.y}" fill="#4a4a3a"/>
                    <!-- 오른쪽 면 -->
                    <polygon points="${p.f2.x},${p.f2.y} ${p.t2.x},${p.t2.y} ${p.t3.x},${p.t3.y} ${p.f3.x},${p.f3.y}" fill="#353525"/>
                    <!-- 지붕 -->
                    <polygon points="${p.t1.x},${p.t1.y} ${p.t2.x},${p.t2.y} ${p.t3.x},${p.t3.y} ${p.t4.x},${p.t4.y}" fill="#5a5a4a"/>
                    ${windows}
                </g>
            `;
            
            // 라벨 (건물 위)
            const labelCx = offsetX + isoX(bx + buildingWidth/2, by + buildingDepth/2);
            const labelCy = offsetY + isoY(bx + buildingWidth/2, by + buildingDepth/2, bHeight + 10);
            elements += drawDotText2D(dayNames[day.weekday], labelCx - 10, labelCy - 20, 3, '#8899bb');
            elements += drawDotText2D(count.toString(), labelCx - 6, labelCy - 5, 4, '#ffdd66');
        }
    }
    
    // 자동차 (도로 위)
    const carX = 150;
    const carY = roadY + 15;
    const carZ = 0;
    
    elements += `
        <g class="car">
            <polygon points="
                ${offsetX + isoX(carX, carY)},${offsetY + isoY(carX, carY, 5)}
                ${offsetX + isoX(carX + 35, carY)},${offsetY + isoY(carX + 35, carY, 5)}
                ${offsetX + isoX(carX + 35, carY + 18)},${offsetY + isoY(carX + 35, carY + 18, 5)}
                ${offsetX + isoX(carX, carY + 18)},${offsetY + isoY(carX, carY + 18, 5)}
            " fill="#1a1a2a"/>
            <polygon points="
                ${offsetX + isoX(carX + 8, carY + 2)},${offsetY + isoY(carX + 8, carY + 2, 12)}
                ${offsetX + isoX(carX + 28, carY + 2)},${offsetY + isoY(carX + 28, carY + 2, 12)}
                ${offsetX + isoX(carX + 28, carY + 16)},${offsetY + isoY(carX + 28, carY + 16, 12)}
                ${offsetX + isoX(carX + 8, carY + 16)},${offsetY + isoY(carX + 8, carY + 16, 12)}
            " fill="#2a2a3a"/>
            <ellipse cx="${offsetX + isoX(carX + 33, carY + 6)}" cy="${offsetY + isoY(carX + 33, carY + 6, 4)}" rx="3" ry="2" fill="#ffff99"/>
            <ellipse cx="${offsetX + isoX(carX + 33, carY + 12)}" cy="${offsetY + isoY(carX + 33, carY + 12, 4)}" rx="3" ry="2" fill="#ffff99"/>
            <ellipse cx="${offsetX + isoX(carX + 2, carY + 6)}" cy="${offsetY + isoY(carX + 2, carY + 6, 4)}" rx="2" ry="1.5" fill="#ff4444"/>
            <ellipse cx="${offsetX + isoX(carX + 2, carY + 12)}" cy="${offsetY + isoY(carX + 2, carY + 12, 4)}" rx="2" ry="1.5" fill="#ff4444"/>
        </g>
    `;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#080810"/>
      <stop offset="60%" style="stop-color:#151525"/>
      <stop offset="100%" style="stop-color:#252535"/>
    </linearGradient>
    
    <style>
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      @keyframes windowFlicker {
        0%, 93%, 100% { opacity: 1; }
        95% { opacity: 0.4; }
      }
      @keyframes lampGlow {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.7; }
      }
      .star { animation: twinkle 2.5s ease-in-out infinite; }
      .window { animation: windowFlicker 5s ease-in-out infinite; }
      .lamp-glow { animation: lampGlow 2s ease-in-out infinite; }
    </style>
  </defs>
  
  <!-- 배경 -->
  <rect width="${width}" height="${height}" fill="url(#skyGradient)"/>
  
  <!-- 별 -->
  ${stars}
  
  <!-- 달 -->
  <circle cx="800" cy="70" r="40" fill="#ffffee"/>
  <circle cx="792" cy="62" r="7" fill="#eeddcc" opacity="0.4"/>
  <circle cx="808" cy="78" r="4" fill="#eeddcc" opacity="0.3"/>
  
  <!-- 요소들 -->
  ${elements}
  
  <!-- 타이틀 -->
  ${drawDotText2D('CONTRIBUTION CITY', width/2 - 100, 25, 4, '#ffffff')}
  
  <!-- 통계 (왼쪽 하단) -->
  ${drawDotText2D('TOTAL: ' + totalContributions, 25, height - 55, 3, '#ffffff')}
  ${drawDotText2D('TODAY: ' + todayContributions, 25, height - 30, 3, '#ffffff')}
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
        
        if (!fs.existsSync('profile-3d-contrib')) {
            fs.mkdirSync('profile-3d-contrib');
        }
        
        fs.writeFileSync('profile-3d-contrib/contribution-city.svg', svg);
        console.log('Generated: profile-3d-contrib/contribution-city.svg');
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();