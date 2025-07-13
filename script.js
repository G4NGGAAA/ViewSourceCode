    document.addEventListener('DOMContentLoaded', function() {
            const urlInput = document.getElementById('url-input');
            const fetchBtn = document.getElementById('fetch-btn');
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const codeContainer = document.getElementById('code-container');
            const codeContent = document.getElementById('code-content');
            const copyBtn = document.getElementById('copy-btn');
            const downloadBtn = document.getElementById('download-btn');
            const fileName = document.getElementById('file-name');
            const fileTree = document.getElementById('file-tree');
            const fileList = document.getElementById('file-list');
            const emptyState = document.getElementById('empty-state');
            const themeToggle = document.getElementById('theme-toggle');
            const tabContainer = document.getElementById('tab-container');
            const tabs = document.querySelectorAll('.tab');
            const stats = document.getElementById('stats');
            const htmlCount = document.getElementById('html-count');
            const cssCount = document.getElementById('css-count');
            const jsCount = document.getElementById('js-count');
            const totalCount = document.getElementById('total-count');
            
            let currentFiles = [];
            let filteredFiles = [];
            let currentTab = 'all';
            
            // Theme toggle
            themeToggle.addEventListener('click', function() {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                themeToggle.innerHTML = isDark 
                    ? '<i class="fas fa-sun"></i> Light Mode' 
                    : '<i class="fas fa-moon"></i> Dark Mode';
                
                // Re-apply syntax highlighting
                if (codeContent.textContent.trim()) {
                    const language = getLanguageFromFileName(fileName.textContent);
                    highlightCode(codeContent, language);
                }
            });
            
            // Tab switching
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    tabs.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    currentTab = this.dataset.tab;
                    filterFiles(currentTab);
                });
            });
            
            // Fetch source code from URL
            fetchBtn.addEventListener('click', async function() {
                const url = urlInput.value.trim();
                
                if (!url) {
                    showError('Please enter a valid URL');
                    return;
                }
                
                // Validate URL
                let parsedUrl;
                try {
                    parsedUrl = new URL(url);
                } catch (e) {
                    showError('Please enter a valid URL');
                    return;
                }
                
                // Show loading and hide error
                loading.style.display = 'block';
                error.style.display = 'none';
                codeContainer.style.display = 'none';
                fileTree.style.display = 'none';
                tabContainer.style.display = 'none';
                stats.style.display = 'none';
                emptyState.style.display = 'flex';
                
                try {
                    // First fetch the main page
                    const mainPageUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
                    const mainPageResponse = await fetchWithCORS(mainPageUrl);
                    
                    if (!mainPageResponse.ok) {
                        throw new Error(`HTTP error! status: ${mainPageResponse.status}`);
                    }
                    
                    const mainPageHtml = await mainPageResponse.text();
                    
                    // Parse HTML to find CSS and JS files
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(mainPageHtml, 'text/html');
                    
                    // Extract all resources
                    const resources = extractResources(doc, parsedUrl);
                    
                    // Prepare files array
                    currentFiles = [
                        {
                            name: 'index.html',
                            type: 'html',
                            content: mainPageHtml,
                            url: mainPageUrl
                        },
                        ...resources.css.map((url, index) => ({
                            name: `style-${index}.css`,
                            type: 'css',
                            url: url,
                            content: null
                        })),
                        ...resources.js.map((url, index) => ({
                            name: `script-${index}.js`,
                            type: 'js',
                            url: url,
                            content: null
                        }))
                    ];
                    
                    // Update stats
                    updateStats();
                    
                    // Display file tree
                    renderFileTree();
                    fileTree.style.display = 'block';
                    tabContainer.style.display = 'flex';
                    stats.style.display = 'flex';
                    
                    // Load the main HTML file by default
                    loadFileContent(currentFiles[0]);
                    
                } catch (err) {
                    console.error(err);
                    showError('An error occurred while fetching the source code. ' + 
                             'This may be due to CORS restrictions. Try a different URL.');
                } finally {
                    loading.style.display = 'none';
                }
            });
            
            // Fetch with CORS proxy
            async function fetchWithCORS(url) {
                try {
                    // First try direct fetch
                    const directResponse = await fetch(url, {
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    
                    if (directResponse.ok) {
                        return directResponse;
                    }
                    
                    // If direct fetch fails, try CORS proxy
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    const proxyResponse = await fetch(proxyUrl);
                    
                    if (!proxyResponse.ok) {
                        throw new Error('Both direct and proxy fetch failed');
                    }
                    
                    return {
                        ok: true,
                        text: async () => {
                            const data = await proxyResponse.json();
                            return data.contents || '';
                        }
                    };
                } catch (error) {
                    throw error;
                }
            }
            
            // Extract CSS and JS resources from HTML
            function extractResources(doc, baseUrl) {
                const cssFiles = [];
                const jsFiles = [];
                
                // Extract CSS links
                const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
                linkElements.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href) {
                        try {
                            const absoluteUrl = new URL(href, baseUrl).href;
                            cssFiles.push(absoluteUrl);
                        } catch (e) {
                            console.warn('Invalid CSS URL:', href);
                        }
                    }
                });
                
                // Extract inline styles
                const styleElements = doc.querySelectorAll('style');
                styleElements.forEach((style, index) => {
                    cssFiles.push(`inline-style-${index}`);
                });
                
                // Extract JS scripts
                const scriptElements = doc.querySelectorAll('script[src]');
                scriptElements.forEach(script => {
                    const src = script.getAttribute('src');
                    if (src) {
                        try {
                            const absoluteUrl = new URL(src, baseUrl).href;
                            jsFiles.push(absoluteUrl);
                        } catch (e) {
                            console.warn('Invalid JS URL:', src);
                        }
                    }
                });
                
                // Extract inline scripts
                const inlineScripts = doc.querySelectorAll('script:not([src])');
                inlineScripts.forEach((script, index) => {
                    jsFiles.push(`inline-script-${index}`);
                });
                
                return { css: cssFiles, js: jsFiles };
            }
            
            // Render file tree
            function renderFileTree() {
                fileList.innerHTML = '';
                
                filteredFiles.forEach((file, index) => {
                    const li = document.createElement('li');
                    li.className = 'file-item';
                    if (index === 0) li.classList.add('active');
                    li.dataset.index = index;
                    
                    let iconClass;
                    if (file.type === 'html') {
                        iconClass = 'fab fa-html5';
                    } else if (file.type === 'css') {
                        iconClass = 'fab fa-css3-alt';
                    } else {
                        iconClass = 'fab fa-js';
                    }
                    
                    li.innerHTML = `
                        <span class="file-icon"><i class="${iconClass}"></i></span>
                        <span>${file.name}</span>
                    `;
                    
                    li.addEventListener('click', () => {
                        document.querySelectorAll('.file-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        li.classList.add('active');
                        loadFileContent(file);
                    });
                    
                    fileList.appendChild(li);
                });
            }
            
            // Load file content
            async function loadFileContent(file) {
                loading.style.display = 'block';
                emptyState.style.display = 'none';
                
                try {
                    let content = file.content;
                    
                    // If content isn't already loaded (for external resources)
                    if (!content && file.url && !file.url.startsWith('inline-')) {
                        const response = await fetchWithCORS(file.url);
                        if (response.ok) {
                            content = await response.text();
                        } else {
                            content = `/* Could not load external resource: ${file.url} */`;
                        }
                    } else if (file.url && file.url.startsWith('inline-style-')) {
                        // Handle inline styles
                        const doc = parser.parseFromString(currentFiles[0].content, 'text/html');
                        const styles = doc.querySelectorAll('style');
                        const index = parseInt(file.url.split('-')[2]);
                        content = styles[index].textContent;
                    } else if (file.url && file.url.startsWith('inline-script-')) {
                        // Handle inline scripts
                        const doc = parser.parseFromString(currentFiles[0].content, 'text/html');
                        const scripts = doc.querySelectorAll('script:not([src])');
                        const index = parseInt(file.url.split('-')[2]);
                        content = scripts[index].textContent;
                    }
                    
                    // Escape HTML entities
                    const escaped = escapeHtml(content);
                    codeContent.textContent = escaped;
                    fileName.textContent = file.name;
                    
                    // Apply syntax highlighting
                    const language = getLanguageFromFileName(file.name);
                    highlightCode(codeContent, language);
                    
                    codeContainer.style.display = 'block';
                    emptyState.style.display = 'none';
                } catch (err) {
                    console.error(err);
                    showError('Failed to load file content');
                } finally {
                    loading.style.display = 'none';
                }
            }
            
            // Highlight code with highlight.js
            function highlightCode(element, language) {
                element.className = `language-${language}`;
                hljs.highlightElement(element);
            }
            
            // Get language from filename
            function getLanguageFromFileName(filename) {
                if (filename.endsWith('.html') || filename.endsWith('.htm')) {
                    return 'html';
                } else if (filename.endsWith('.css')) {
                    return 'css';
                } else if (filename.endsWith('.js')) {
                    return 'javascript';
                }
                return 'plaintext';
            }
            
            // Filter files by type
            function filterFiles(type) {
                if (type === 'all') {
                    filteredFiles = [...currentFiles];
                } else {
                    filteredFiles = currentFiles.filter(file => file.type === type);
                }
                
                renderFileTree();
                
                if (filteredFiles.length > 0) {
                    loadFileContent(filteredFiles[0]);
                } else {
                    codeContainer.style.display = 'none';
                    emptyState.style.display = 'flex';
                }
            }
            
            // Update statistics
            function updateStats() {
                const htmlFiles = currentFiles.filter(f => f.type === 'html').length;
                const cssFiles = currentFiles.filter(f => f.type === 'css').length;
                const jsFiles = currentFiles.filter(f => f.type === 'js').length;
                
                htmlCount.textContent = htmlFiles;
                cssCount.textContent = cssFiles;
                jsCount.textContent = jsFiles;
                totalCount.textContent = currentFiles.length;
                
                filteredFiles = [...currentFiles];
            }
            
            // Copy to clipboard
            copyBtn.addEventListener('click', function() {
                const textToCopy = codeContent.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            });
            
            // Download file
            downloadBtn.addEventListener('click', function() {
                const textToDownload = codeContent.textContent;
                const blob = new Blob([textToDownload], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName.textContent;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
            
            // Helper function to escape HTML
            function escapeHtml(unsafe) {
                if (!unsafe) return '';
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
            
            // Helper function to show error message
            function showError(message) {
                error.textContent = message;
                error.style.display = 'block';
            }
        });
