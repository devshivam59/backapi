const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Real Kite Connect auto-login endpoint
router.post('/', async (req, res) => {
  try {
    console.log('Starting real Kite auto-login process...');
    
    // Run the actual auto-login script
    const autoLoginPath = path.join(__dirname, '../../auto-login.cjs');
    
    if (!fs.existsSync(autoLoginPath)) {
      throw new Error('Auto-login script not found');
    }

    const child = spawn('node', [autoLoginPath], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Auto-login stdout:', data.toString());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Auto-login stderr:', data.toString());
    });

    child.on('close', (code) => {
      console.log('Auto-login process finished with code:', code);
      
      if (code === 0) {
        // Check if token file was created
        const tokenPath = path.join(__dirname, '../../kite_token.json');
        
        if (fs.existsSync(tokenPath)) {
          try {
            const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            
            res.json({
              success: true,
              message: 'Access token generated successfully',
              data: {
                access_token: tokenData.access_token,
                public_token: tokenData.public_token,
                refresh_token: tokenData.refresh_token,
                user_id: tokenData.user_id,
                user_name: tokenData.user_name,
                user_shortname: tokenData.user_shortname,
                email: tokenData.email,
                user_type: tokenData.user_type,
                broker: tokenData.broker || 'ZERODHA',
                exchanges: tokenData.exchanges || ['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX'],
                products: tokenData.products || ['CNC', 'MIS', 'NRML'],
                order_types: tokenData.order_types || ['MARKET', 'LIMIT', 'SL', 'SL-M'],
                api_key: process.env.API_KEY,
                login_time: tokenData.login_time,
                expires: tokenData.expires,
                generated_at: new Date().toISOString()
              }
            });
          } catch (parseError) {
            console.error('Error parsing token file:', parseError);
            res.status(500).json({
              success: false,
              message: 'Token file created but could not be parsed',
              error: parseError.message,
              stdout: stdout,
              stderr: stderr
            });
          }
        } else {
          res.status(500).json({
            success: false,
            message: 'Auto-login completed but no token file was created',
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Auto-login process failed',
          error: `Process exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    child.on('error', (error) => {
      console.error('Auto-login process error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start auto-login process',
        error: error.message
      });
    });

    // Set a timeout for the process
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
        res.status(500).json({
          success: false,
          message: 'Auto-login process timed out',
          stdout: stdout,
          stderr: stderr
        });
      }
    }, 60000); // 60 second timeout

  } catch (error) {
    console.error('Kite auto-login error:', error);
    res.status(500).json({
      success: false,
      message: 'Auto-login failed',
      error: error.message
    });
  }
});

// Refresh token endpoint
router.post('/', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Use KiteConnect to refresh the token
    const { KiteConnect } = require('kiteconnect');
    const kite = new KiteConnect({ api_key: process.env.API_KEY });
    
    try {
      const session = await kite.renewAccessToken(refresh_token, process.env.API_SECRET);
      
      // Update the token file
      const tokenPath = path.join(__dirname, '../../kite_token.json');
      let tokenData = {};
      
      if (fs.existsSync(tokenPath)) {
        tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      }
      
      tokenData.access_token = session.access_token;
      tokenData.refresh_token = session.refresh_token || refresh_token;
      tokenData.refreshed_at = new Date().toISOString();
      
      fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          access_token: session.access_token,
          refresh_token: session.refresh_token || refresh_token,
          refreshed_at: tokenData.refreshed_at
        }
      });
      
    } catch (refreshError) {
      console.error('Token refresh error:', refreshError);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
        error: refreshError.message
      });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
});

// Get current token status
router.get('/', async (req, res) => {
  try {
    const tokenPath = path.join(__dirname, '../../kite_token.json');
    
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      
      res.json({
        success: true,
        data: {
          has_token: true,
          user_id: tokenData.user_id,
          user_name: tokenData.user_name,
          access_token: tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : null,
          generated_at: tokenData.login_time || tokenData.generated_at,
          expires_at: tokenData.expires,
          api_key: process.env.API_KEY
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          has_token: false,
          message: 'No token file found'
        }
      });
    }

  } catch (error) {
    console.error('Token status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get token status',
      error: error.message
    });
  }
});

// Clear token endpoint
router.delete('/', async (req, res) => {
  try {
    const tokenPath = path.join(__dirname, '../../kite_token.json');
    
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    
    res.json({
      success: true,
      message: 'Token cleared successfully'
    });

  } catch (error) {
    console.error('Token clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear token',
      error: error.message
    });
  }
});

module.exports = router;
