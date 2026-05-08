# Permissions and Ownership

> In the Unix philosophy of "everything is a file," permission management is the cornerstone of security.
> Proper permission settings form the foundation of preventing unauthorized access, protecting data, and maintaining system stability.

## What You Will Learn in This Chapter

- [ ] Master how to read and change file permissions
- [ ] Manage owners and groups
- [ ] Understand special permissions (SUID/SGID/Sticky Bit)
- [ ] Implement fine-grained access control with ACL (Access Control List)
- [ ] Understand how umask works and configure it appropriately
- [ ] Apply security best practices
- [ ] Troubleshoot permission-related issues


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Creating, Copying, Moving, and Deleting Files](./01-file-crud.md)

---

## 1. Permission Basics

### 1.1 Reading Permissions

```bash
# Display permissions
$ ls -la
-rwxr-xr-- 1 user group 4096 Jan 1 file.txt
│├─┤├─┤├─┤   │     │
│ │  │  │     │     └── group
│ │  │  │     └── owner
│ │  │  └── other: read only (r--)
│ │  └── group: read+execute (r-x)
│ └── owner: full permissions (rwx)
└── type: - file, d dir, l link

# File type overview
# -  : regular file
# d  : directory
# l  : symbolic link
# c  : character device (/dev/tty, etc.)
# b  : block device (/dev/sda, etc.)
# p  : named pipe (FIFO)
# s  : socket

# Meaning of each permission
# For files:
#   r (read)    : can read file contents (cat, less, etc.)
#   w (write)   : can modify file contents (vi, echo >>, etc.)
#   x (execute) : can execute the file (./script.sh)
#
# For directories:
#   r (read)    : can list files in the directory (ls)
#   w (write)   : can create and delete files inside the directory
#   x (execute) : can enter the directory (cd) and access files inside
```

### 1.2 The Relationship Between Permissions and Directories

```bash
# Experimenting with directory permissions

# Case 1: directory without x
$ mkdir /tmp/test_dir
$ chmod 644 /tmp/test_dir     # rw-r--r-- (no x)
$ ls /tmp/test_dir             # Error: Permission denied
$ cd /tmp/test_dir             # Error: Permission denied

# Case 2: directory without r
$ chmod 311 /tmp/test_dir     # --x--x--x (no r)
$ cd /tmp/test_dir             # OK: can enter
$ ls /tmp/test_dir             # Error: cannot list contents
$ cat /tmp/test_dir/known.txt  # OK: accessible if you know the filename

# Case 3: combination of w + x
$ chmod 733 /tmp/test_dir     # rwx-wx-wx
$ touch /tmp/test_dir/new.txt  # OK: can create files
$ rm /tmp/test_dir/old.txt     # OK: can delete files
$ ls /tmp/test_dir             # Error: cannot list contents

# Case 4: w without x means no write access
$ chmod 622 /tmp/test_dir     # rw--w--w- (no x)
$ touch /tmp/test_dir/new.txt  # Error: no access without x
```

### 1.3 Numeric (Octal) Representation

```bash
# Bit values
# r = 4 (100 in binary)
# w = 2 (010 in binary)
# x = 1 (001 in binary)

# Calculation: add bits for each category
# rwx = 4+2+1 = 7
# rw- = 4+2+0 = 6
# r-x = 4+0+1 = 5
# r-- = 4+0+0 = 4
# -wx = 0+2+1 = 3
# -w- = 0+2+0 = 2
# --x = 0+0+1 = 1
# --- = 0+0+0 = 0

# Commonly used permissions
chmod 777 file    # rwxrwxrwx — full access for everyone (not recommended)
chmod 755 file    # rwxr-xr-x — standard for executables/directories
chmod 750 file    # rwxr-x--- — executable by group and owner
chmod 700 file    # rwx------ — full access for owner only
chmod 644 file    # rw-r--r-- — standard for regular files
chmod 640 file    # rw-r----- — readable by group
chmod 600 file    # rw------- — secret files (SSH keys, etc.)
chmod 555 file    # r-xr-xr-x — read+execute only (no editing)
chmod 444 file    # r--r--r-- — read-only
chmod 400 file    # r-------- — owner read-only

# Commonly used permissions for directories
chmod 755 dir/    # rwxr-xr-x — public directory
chmod 750 dir/    # rwxr-x--- — group-restricted directory
chmod 700 dir/    # rwx------ — private directory
chmod 1777 dir/   # rwxrwxrwt — shared directory (like /tmp)
chmod 2755 dir/   # rwxr-sr-x — SGID directory

# 4-digit notation (including special bits)
# First digit: special bits
#   4 = SUID
#   2 = SGID
#   1 = Sticky Bit
chmod 4755 file   # SUID + rwxr-xr-x
chmod 2755 dir/   # SGID + rwxr-xr-x
chmod 1777 dir/   # Sticky + rwxrwxrwx
chmod 6755 file   # SUID + SGID + rwxr-xr-x
```

### 1.4 Symbolic Representation

```bash
# Specifying targets
# u = user (owner)
# g = group
# o = others
# a = all (same as ugo)

# Specifying operations
# + = add permission
# - = remove permission
# = = set permission (only the specified permissions)

# Basic usage
chmod u+x file.txt         # add execute to owner
chmod g-w file.txt         # remove write from group
chmod o=r file.txt         # set others to read only
chmod a+r file.txt         # add read to everyone
chmod ug+rw file.txt       # add read/write to owner and group
chmod u=rwx,g=rx,o=r file  # explicitly set all (= 754)

# Multiple operations at once
chmod u+x,g-w,o-rwx file   # owner +x, group -w, others remove all
chmod a=r,u+w file          # all get r, owner +w (= 644)

# Reference copy
chmod --reference=ref.txt target.txt  # set same permissions as ref.txt

# Recursive change
chmod -R 755 dir/           # recursively change all contents

# Distinguish directories and files for recursive setting
# To set directories: 755, files: 644
find /path -type d -exec chmod 755 {} \;
find /path -type f -exec chmod 644 {} \;

# Uppercase X: set x only on directories or files that already have x
chmod -R u=rwX,g=rX,o=rX dir/
# → directories get x
# → files do not get x (except files that already had x)

# verbose mode: show changes
chmod -v 644 *.txt
# mode of 'file1.txt' changed from 0755 (rwxr-xr-x) to 0644 (rw-r--r--)
# mode of 'file2.txt' retained as 0644 (rw-r--r--)

# changes mode: show only when actually changed
chmod -c 644 *.txt
# mode of 'file1.txt' changed from 0755 (rwxr-xr-x) to 0644 (rw-r--r--)
```

### 1.5 Detailed Display with the stat Command

```bash
# Check permission details with stat
$ stat file.txt
  File: file.txt
  Size: 4096        Blocks: 8          IO Block: 4096   regular file
Device: fd00h/64768d Inode: 1234567     Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/   user)  Gid: ( 1000/  group)
Access: 2026-01-15 10:30:00.000000000 +0900
Modify: 2026-01-14 09:20:00.000000000 +0900
Change: 2026-01-14 09:20:00.000000000 +0900
 Birth: 2026-01-10 08:00:00.000000000 +0900

# macOS stat (BSD version)
$ stat -f "%Sp %Su %Sg %z %N" file.txt
# -rw-r--r-- user group 4096 file.txt

# Linux stat (GNU version) with format specification
$ stat -c "%A %U %G %s %n" file.txt
# -rw-r--r-- user group 4096 file.txt

# Display as numeric (Linux)
$ stat -c "%a %n" file.txt
# 644 file.txt

# Numeric display on macOS
$ stat -f "%OLp %N" file.txt
# 644 file.txt

# Check access timestamps
$ stat -c "Access: %x\nModify: %y\nChange: %z" file.txt
# Access: 2026-01-15 10:30:00
# Modify: 2026-01-14 09:20:00
# Change: 2026-01-14 09:20:00

# Check permissions of multiple files at once
$ stat -c "%a %A %U:%G %n" /etc/passwd /etc/shadow /etc/group
# 644 -rw-r--r-- root:root /etc/passwd
# 640 -rw-r----- root:shadow /etc/shadow
# 644 -rw-r--r-- root:root /etc/group
```

---

## 2. Owners and Groups

### 2.1 chown — Change Owner

```bash
# Basic syntax: chown [OPTION] [OWNER][:[GROUP]] FILE

# Change owner (requires root)
sudo chown user file.txt             # change owner to user
sudo chown user:group file.txt       # change owner and group simultaneously
sudo chown :group file.txt           # change group only (equivalent to chgrp)
sudo chown user: file.txt            # change owner + set group to owner's default group

# Recursive change
sudo chown -R user:group dir/        # change all contents recursively
sudo chown -R --preserve-root user:group /  # prevent recursive change to /

# verbose/changes mode
sudo chown -v user:group file.txt    # show all changes
sudo chown -c user:group file.txt    # show only when actually changed

# Reference copy
sudo chown --reference=ref.txt target.txt  # set same owner as ref.txt

# Handling symbolic links
sudo chown user symlink              # change the linked file
sudo chown -h user symlink           # change the symbolic link itself

# from option: change only when current owner matches
sudo chown --from=olduser newuser file.txt
sudo chown --from=:oldgroup user:newgroup file.txt

# Practical example: web server document root
sudo chown -R www-data:www-data /var/www/html/
sudo chown -R nginx:nginx /usr/share/nginx/html/

# Practical example: repair home directory
sudo chown -R $USER:$(id -gn $USER) ~/

# Practical example: change only files owned by a specific user
sudo find /shared -user olduser -exec chown newuser {} \;
```

### 2.2 chgrp — Change Group

```bash
# Basic syntax: chgrp [OPTION] GROUP FILE

# Change group
sudo chgrp developers project/       # change group to developers
sudo chgrp -R developers project/    # change group recursively

# verbose mode
sudo chgrp -vc developers *.py       # show only files that changed

# Reference copy
sudo chgrp --reference=ref.txt target.txt

# Changing to a group you belong to does not require sudo
# (when you are a member of that group)
chgrp mygroup file.txt

# Practical example: shared project directory
sudo chgrp -R devteam /opt/project/
sudo chmod -R g+rw /opt/project/
sudo chmod g+s /opt/project/         # inherit group for new files
```

### 2.3 User and Group Management

```bash
# Current user information
whoami                               # current username
id                                   # UID, GID, all groups
id -u                                # UID only
id -g                                # primary GID only
id -G                                # all GIDs
id -Gn                               # all group names
id username                          # information for a specific user

# Group list
groups                               # your group list
groups username                      # group list for a specific user
getent group                         # system-wide group list
getent group groupname               # check members of a specific group

# Add user
sudo useradd -m -s /bin/bash newuser          # create home + specify shell
sudo useradd -m -G sudo,docker newuser        # specify additional groups
sudo adduser newuser                          # interactive (Debian-based)

# Create and manage groups
sudo groupadd developers                      # create group
sudo groupadd -g 1500 custom                  # create with specific GID
sudo groupdel oldgroup                         # delete group

# Add user to group
sudo usermod -aG docker $USER                  # add to docker group
sudo usermod -aG sudo,adm,www-data user       # add to multiple groups
# Note: forgetting -a will remove from all existing groups!
# sudo usermod -G docker user  ← Dangerous! Removes from all groups except docker

# Apply group changes
newgrp docker                                  # start new shell with the group
# or log out and log back in

# Change user's primary group
sudo usermod -g newgroup user

# Remove user from group
sudo gpasswd -d user groupname

# Check /etc/passwd
getent passwd username
# username:x:1000:1000:Full Name:/home/username:/bin/bash
# username:password(x=shadow):UID:GID:comment:home:shell

# Check /etc/group
getent group groupname
# groupname:x:1000:user1,user2
# groupname:password:GID:member list

# /etc/shadow (password info, requires root)
sudo getent shadow username
```

### 2.4 Understanding UID and GID

```bash
# UID/GID ranges (typical Linux distributions)
# 0       : root
# 1-999   : system users/groups (daemons, etc.)
# 1000+   : regular users/groups
# 65534   : nobody/nogroup (user with no permissions)

# Important system users
id root          # uid=0(root) gid=0(root)
id nobody        # uid=65534(nobody) gid=65534(nogroup)
id www-data      # uid=33(www-data) gid=33(www-data) (Debian-based)

# UID/GID mapping in Docker
# container UID = host UID
# running as root(0) in container → root privileges on host
# recommended to run as non-root user for security
docker run --user 1000:1000 myimage

# Check file UID/GID as numbers
ls -ln file.txt
# -rw-r--r-- 1 1000 1000 4096 Jan 1 file.txt

# Files with non-existent UID/GID
# Occurs after user deletion or during NFS mounts
$ ls -la orphaned.txt
-rw-r--r-- 1 5001 5001 100 Jan 1 orphaned.txt
# numeric display = no user/group exists for that UID/GID

# Find orphaned files
find / -nouser -o -nogroup 2>/dev/null
```

---

## 3. umask — Default Permissions

### 3.1 How umask Works

```bash
# umask is a "mask" that controls permissions for new files/directories
# Specifies bits that should NOT be granted

# Basic calculation:
# Maximum permission for files       : 666 (no execute)
# Maximum permission for directories : 777

# With umask = 022:
# File      : 666 - 022 = 644 (rw-r--r--)
# Directory : 777 - 022 = 755 (rwxr-xr-x)

# With umask = 002:
# File      : 666 - 002 = 664 (rw-rw-r--)
# Directory : 777 - 002 = 775 (rwxrwxr-x)

# With umask = 077:
# File      : 666 - 077 = 600 (rw-------)
# Directory : 777 - 077 = 700 (rwx------)

# Check current umask
umask            # numeric display (e.g., 0022)
umask -S         # symbolic display (e.g., u=rwx,g=rx,o=rx)

# Temporary umask change (current shell only)
umask 077        # secure setting
touch secret.txt # → 600 (rw-------)
mkdir private/   # → 700 (rwx------)

# Permanent umask setting
# Add to ~/.bashrc or ~/.zshrc
echo "umask 022" >> ~/.bashrc
```

### 3.2 The Precise umask Calculation

```bash
# Actually "subtraction" but rather "bitwise operation"
# result = max_perm AND (NOT umask)
#
# Example: umask=033
# File: 666 AND (NOT 033)
# 666 = 110 110 110
# 033 = 000 011 011
# NOT = 111 100 100
# AND = 110 100 100 = 644
#
# Subtraction would give 666 - 033 = 633, but the actual result is 644
# → Because it's bitwise, "over-subtraction" doesn't occur

# Verification
$ umask 033
$ touch test_umask.txt
$ stat -c "%a" test_umask.txt
644    # 644, not 633

# Commonly used umask values
# 022 : default (typical Linux)
# 002 : for group sharing (default on Red Hat-based systems)
# 027 : secure (no permissions for others)
# 077 : most secure (owner only)
# 000 : most permissive (for testing)

# umask per process
# umask is a process attribute and is inherited by child processes
bash -c 'umask; umask 077; umask'
# 0022  ← parent's umask
# 0077  ← umask after change (this subshell only)
umask  # unchanged in parent shell
# 0022
```

### 3.3 umask Settings by Use Case

```bash
# For personal work (default)
umask 022
# File: 644, Directory: 755

# For team development
umask 002
# File: 664, Directory: 775
# Group members can edit files

# For secure servers
umask 077
# File: 600, Directory: 700
# No access for anyone other than the owner

# Conditional umask setting (~/.bashrc)
# Use secure setting for SSH connections
if [ -n "$SSH_CLIENT" ]; then
    umask 077
else
    umask 022
fi

# Per-directory umask (combined with direnv)
# /shared/project/.envrc
# umask 002

# umask setting for systemd services
# /etc/systemd/system/myapp.service
# [Service]
# UMask=0027
```

---

## 4. Special Permissions

### 4.1 SUID (Set User ID)

```bash
# SUID: the file is executed with the file owner's privileges
# Numeric: 4000
# Symbolic: u+s
# Display: -rwsr-xr-x (owner's x becomes s)

# Setting SUID
chmod u+s executable
chmod 4755 executable

# When SUID is uppercase S: no execute permission + SUID set
# -rwSr-xr-x → owner has no x but SUID is set (meaningless setting)

# Representative commands with SUID
$ ls -la /usr/bin/passwd
-rwsr-xr-x 1 root root 68208 May 28 2020 /usr/bin/passwd
# → runs with root privileges to update /etc/shadow even when executed by a regular user

$ ls -la /usr/bin/sudo
-rwsr-xr-x 1 root root 166056 Jan 19 2021 /usr/bin/sudo
# → executes commands with root privileges

$ ls -la /usr/bin/ping
-rwsr-xr-x 1 root root 64424 Jun 28 2019 /usr/bin/ping
# → requires root privileges to use raw sockets

# Find SUID files (security audit)
find / -perm -4000 -type f 2>/dev/null
find / -perm -4000 -type f -exec ls -la {} \; 2>/dev/null

# SUID security risks
# - Improper SUID settings can lead to privilege escalation vulnerabilities
# - Do not set SUID on custom scripts
# - Audit SUID files periodically
# - SUID on shell scripts is ignored on most OSes

# Save list of SUID files (create baseline)
find / -perm -4000 -type f 2>/dev/null | sort > /tmp/suid_baseline.txt
# Compare periodically
find / -perm -4000 -type f 2>/dev/null | sort | diff /tmp/suid_baseline.txt -
```

### 4.2 SGID (Set Group ID)

```bash
# SGID on file: executed with the file's group privileges
# SGID on directory: new files inherit the parent directory's group
# Numeric: 2000
# Symbolic: g+s
# Display: -rwxr-sr-x (group's x becomes s)

# Setting SGID on a file
chmod g+s executable
chmod 2755 executable

# Setting SGID on a directory (most practical use)
chmod g+s /shared/project/
chmod 2775 /shared/project/

# Verify SGID directory behavior
$ mkdir /tmp/sgid_test
$ sudo chown :developers /tmp/sgid_test
$ chmod 2775 /tmp/sgid_test
$ ls -la /tmp/ | grep sgid_test
drwxrwsr-x 2 user developers 4096 Jan 1 sgid_test
#                ^ s is set

$ touch /tmp/sgid_test/newfile.txt
$ ls -la /tmp/sgid_test/newfile.txt
-rw-r--r-- 1 user developers 0 Jan 1 newfile.txt
#                  ^ parent directory's group (developers) was inherited

# Without SGID
$ mkdir /tmp/nosgid_test
$ sudo chown :developers /tmp/nosgid_test
$ chmod 775 /tmp/nosgid_test
$ touch /tmp/nosgid_test/newfile.txt
$ ls -la /tmp/nosgid_test/newfile.txt
-rw-r--r-- 1 user user 0 Jan 1 newfile.txt
#                  ^ becomes the user's primary group

# Correct setup for team shared directory
sudo mkdir -p /opt/shared/project
sudo groupadd devteam
sudo chown root:devteam /opt/shared/project
sudo chmod 2775 /opt/shared/project
# → all files created by members will belong to devteam group

# Find SGID files
find / -perm -2000 -type f 2>/dev/null
find / -perm -2000 -type d 2>/dev/null  # also directories
```

### 4.3 Sticky Bit

```bash
# Sticky Bit: restricts file deletion within a directory to the owner and root
# Numeric: 1000
# Symbolic: +t
# Display: drwxrwxrwt (other's x becomes t)

# Setting Sticky Bit
chmod +t /shared/
chmod 1777 /shared/

# /tmp is a representative Sticky Bit directory
$ ls -ld /tmp
drwxrwxrwt 20 root root 4096 Jan 1 /tmp
#                             ^ t is set

# Verify Sticky Bit behavior
# User A creates a file
$ touch /tmp/userA_file.txt

# User B attempts to delete it
$ sudo -u userB rm /tmp/userA_file.txt
rm: cannot remove '/tmp/userA_file.txt': Operation not permitted
# → Sticky Bit prevents anyone other than the owner from deleting

# However, the owner and root can delete
$ rm /tmp/userA_file.txt        # OK (owner)
$ sudo rm /tmp/userA_file.txt   # OK (root)

# Combining Sticky Bit + SGID (team sharing)
sudo mkdir /shared/team
sudo chown root:devteam /shared/team
sudo chmod 3775 /shared/team
# → 3 = SGID(2) + Sticky(1)
# → group is inherited, but other members' files cannot be deleted

# Uppercase T: no execute permission + Sticky Bit set
# drwxrwxrwT → others have no x and Sticky is set (meaningless setting)

# Find directories with Sticky Bit
find / -perm -1000 -type d 2>/dev/null
```

### 4.4 Displaying and Checking Special Permissions

```bash
# Special permission display in ls -la
# SUID: owner's x position
#   s = SUID + execute permission
#   S = SUID + no execute permission (usually a misconfiguration)

# SGID: group's x position
#   s = SGID + execute permission
#   S = SGID + no execute permission

# Sticky: other's x position
#   t = Sticky + execute permission
#   T = Sticky + no execute permission

# Concrete display examples
# -rwsr-xr-x : SUID set, everyone can execute
# -rwxr-sr-x : SGID set
# drwxrwxrwt : Sticky Bit set
# -rwSr--r-- : SUID set but owner has no execute (problem)
# -rwxr-Sr-- : SGID set but group has no execute (problem)
# drwxrwxrwT : Sticky set but others have no execute (problem)

# Numeric confirmation with stat
stat -c "%a %A %n" /usr/bin/passwd
# 4755 -rwsr-xr-x /usr/bin/passwd

stat -c "%a %A %n" /tmp
# 1777 drwxrwxrwt /tmp

# Find all files with special permissions
find / -perm /7000 -type f 2>/dev/null | head -20
# /7000 = any of SUID(4000) OR SGID(2000) OR Sticky(1000)
```

---

## 5. ACL (Access Control List)

### 5.1 Basic Concepts of ACL

```bash
# ACL = fine-grained access control beyond standard user/group/other
# Allows granting individual permissions to specific users or groups

# When ACL is needed:
# - You want to allow access to specific groups other than the owner's group
# - You want to give write permissions to only specific users
# - You want to set different access levels for multiple groups

# Check ACL installation
which getfacl setfacl
# Ubuntu/Debian: sudo apt install acl
# CentOS/RHEL: sudo yum install acl

# Check filesystem ACL support
mount | grep acl
# ext4, xfs, btrfs typically support ACL
# must be mounted with mount -o acl

# Check ACL support with tune2fs (ext4)
sudo tune2fs -l /dev/sda1 | grep -i acl
# Default mount options: ... acl ...
```

### 5.2 getfacl — Display ACL

```bash
# Basic ACL display
$ getfacl file.txt
# file: file.txt
# owner: user
# group: group
user::rw-           # owner permissions
group::r--          # group permissions
other::r--          # other permissions

# When ACL is set
$ getfacl file.txt
# file: file.txt
# owner: user
# group: group
user::rw-           # owner
user:alice:rw-      # individual rw permission for alice
user:bob:r--        # individual r permission for bob
group::r--          # owner group
group:devteam:rw-   # rw permission for devteam group
mask::rw-           # effective maximum permission
other::r--          # others

# How to identify files with ACL set
$ ls -la
-rw-rw-r--+ 1 user group 4096 Jan 1 file.txt
#          ^ + mark indicates ACL is set

# Directory ACL (including default ACL)
$ getfacl dir/
# file: dir/
# owner: user
# group: group
user::rwx
group::r-x
other::r-x
default:user::rwx          # default for new files: owner
default:user:alice:rw-     # default for new files: alice
default:group::r-x         # default for new files: group
default:mask::rwx          # default for new files: mask
default:other::r-x         # default for new files: others

# Display ACL recursively
getfacl -R dir/

# Display as numeric
getfacl --omit-header -e n file.txt

# Search only files with ACL
getfacl -R -s -p dir/ 2>/dev/null
```

### 5.3 setfacl — Set ACL

```bash
# Basic syntax: setfacl [OPTIONS] [operation] FILE

# Add user ACL
setfacl -m u:alice:rw file.txt       # add rw permission for alice
setfacl -m u:bob:r file.txt          # add r permission for bob
setfacl -m u:charlie:rwx script.sh   # add rwx permission for charlie

# Add group ACL
setfacl -m g:devteam:rw file.txt     # rw permission for devteam group
setfacl -m g:qa:r file.txt           # r permission for qa group

# Set other ACL
setfacl -m o::r file.txt             # set permissions for others

# Set multiple ACLs at once
setfacl -m u:alice:rw,u:bob:r,g:devteam:rw file.txt

# Remove ACL
setfacl -x u:alice file.txt          # remove alice's ACL entry
setfacl -x g:devteam file.txt        # remove devteam's ACL entry

# Remove all ACLs
setfacl -b file.txt                  # remove all ACLs (base permissions remain)

# Default ACL (for directories)
# ACL automatically applied to newly created files/directories
setfacl -d -m u:alice:rw dir/        # set default ACL
setfacl -d -m g:devteam:rwx dir/     # set default ACL

# Remove default ACL
setfacl -k dir/                      # remove only default ACL

# Set ACL recursively
setfacl -R -m u:alice:rw dir/        # apply to existing files too
setfacl -R -d -m u:alice:rw dir/     # default ACL on existing directories

# Backup and restore ACL
getfacl -R dir/ > acl_backup.txt     # backup
setfacl --restore=acl_backup.txt     # restore

# Set mask
setfacl -m m::r file.txt             # set mask to r
# mask limits the effective maximum permission for ACL users/groups
# e.g., u:alice:rw with mask::r → effective permission is r only

# Prevent automatic mask recalculation
setfacl -n -m u:alice:rw file.txt    # do not auto-update mask
```

### 5.4 ACL Practical Patterns

```bash
# Pattern 1: Shared setup for project directory
sudo mkdir -p /projects/webapp
sudo chown root:devteam /projects/webapp
sudo chmod 2770 /projects/webapp

# Dev team: full access
setfacl -R -m g:devteam:rwx /projects/webapp
setfacl -R -d -m g:devteam:rwx /projects/webapp

# QA team: read only
setfacl -R -m g:qa:rx /projects/webapp
setfacl -R -d -m g:qa:rx /projects/webapp

# External consultant: specific directory only
setfacl -m u:consultant:rx /projects/webapp/docs
setfacl -R -m u:consultant:rx /projects/webapp/docs/

# Pattern 2: Access control for log files
# Grant log viewing permissions to a specific user
setfacl -m u:logviewer:r /var/log/app/app.log
setfacl -d -m u:logviewer:r /var/log/app/

# Pattern 3: Web server and deploy user coexistence
setfacl -R -m u:www-data:rx /var/www/html/
setfacl -R -m u:deploy:rwx /var/www/html/
setfacl -R -d -m u:www-data:rx /var/www/html/
setfacl -R -d -m u:deploy:rwx /var/www/html/

# Pattern 4: Read-only access for backups
setfacl -R -m u:backup:rx /important/data/
setfacl -R -d -m u:backup:rx /important/data/

# Checking ACL results
$ getfacl /projects/webapp/newfile.txt
# file: projects/webapp/newfile.txt
# owner: developer1
# group: devteam
user::rw-
user:consultant:r-x     #effective:r--   ← restricted by mask
group::rwx               #effective:rw-   ← restricted by mask
group:devteam:rwx        #effective:rw-   ← restricted by mask
group:qa:r-x             #effective:r--   ← restricted by mask
mask::rw-                                  ← effective maximum permission
other::---
```

### 5.5 Relationship Between ACL and Standard Permissions

```bash
# Interaction between ACL and chmod
# chmod affects the ACL mask

# Example: set rwx permission for alice with ACL
setfacl -m u:alice:rwx file.txt
getfacl file.txt
# user:alice:rwx
# mask::rwx

# Changing group permissions with chmod also changes the mask
chmod 644 file.txt
getfacl file.txt
# user:alice:rwx    #effective:r--  ← restricted by mask!
# mask::r--         ← chmod changed the mask

# Solution: reset mask after chmod
chmod 644 file.txt
setfacl -m m::rwx file.txt  # explicitly set mask to rwx

# ACL priority order
# 1. Owner (user::) → always applied
# 2. Named user ACL (user:name:) → restricted by mask
# 3. Owner group (group::) → restricted by mask (when ACL exists)
# 4. Named group ACL (group:name:) → restricted by mask
# 5. Others (other::) → always applied

# ACL preservation with cp and mv
cp --preserve=all src.txt dst.txt    # copy preserving ACL
cp -a src/ dst/                       # recursive copy preserving ACL
mv src.txt dst.txt                    # ACL preserved within the same FS

# ACL preservation with tar
tar --acls -czf backup.tar.gz dir/   # archive with ACL
tar --acls -xzf backup.tar.gz       # extract with ACL

# ACL preservation with rsync
rsync -avA src/ dst/                 # sync ACL with -A
```

---

## 6. Permission Settings for Security Purposes

### 6.1 Required Permissions for SSH

```bash
# SSH performs strict permission checks
# Improper permissions will cause SSH connection to be rejected

# Home directory
chmod 755 ~                   # or 700
# SSH is rejected if home directory is writable by others

# .ssh directory
chmod 700 ~/.ssh              # owner only
chown $USER:$(id -gn) ~/.ssh

# Private key
chmod 600 ~/.ssh/id_rsa       # owner read/write only
chmod 600 ~/.ssh/id_ed25519   # Ed25519 key
# 400 is also fine (read-only)
chmod 400 ~/.ssh/id_rsa       # more secure

# Public key
chmod 644 ~/.ssh/id_rsa.pub   # readable by everyone

# authorized_keys
chmod 600 ~/.ssh/authorized_keys
# or 644

# known_hosts
chmod 644 ~/.ssh/known_hosts

# config file
chmod 600 ~/.ssh/config

# SSH server side settings
chmod 600 /etc/ssh/sshd_config
chmod 600 /etc/ssh/ssh_host_*_key      # host private keys
chmod 644 /etc/ssh/ssh_host_*_key.pub  # host public keys

# Batch fix script
fix_ssh_permissions() {
    chmod 700 ~/.ssh
    chmod 600 ~/.ssh/id_* 2>/dev/null
    chmod 644 ~/.ssh/*.pub 2>/dev/null
    chmod 600 ~/.ssh/authorized_keys 2>/dev/null
    chmod 600 ~/.ssh/config 2>/dev/null
    chmod 644 ~/.ssh/known_hosts 2>/dev/null
    echo "SSH permissions fixed."
}

# Check SSH permission errors
ssh -vvv user@host 2>&1 | grep -i permission
# debug1: identity file /home/user/.ssh/id_rsa type 0
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# @ WARNING: UNPROTECTED PRIVATE KEY FILE!      @
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# Permissions 0644 for '/home/user/.ssh/id_rsa' are too open.
```

### 6.2 Web Server Permission Settings

```bash
# ===== Common for Apache / Nginx =====

# Document root
sudo chown -R root:www-data /var/www/html/
sudo chmod -R 750 /var/www/html/
# File: 640 (rw-r-----)
# Directory: 750 (rwxr-x---)

find /var/www/html -type f -exec chmod 640 {} \;
find /var/www/html -type d -exec chmod 750 {} \;

# Upload directory
sudo mkdir -p /var/www/html/uploads
sudo chown www-data:www-data /var/www/html/uploads
sudo chmod 770 /var/www/html/uploads

# CGI/scripts
sudo chmod 750 /var/www/cgi-bin/*.cgi

# Configuration files
sudo chmod 600 /etc/apache2/apache2.conf
sudo chmod 600 /etc/nginx/nginx.conf
sudo chmod 600 /etc/nginx/conf.d/*.conf

# SSL certificates
sudo chmod 600 /etc/ssl/private/server.key
sudo chmod 644 /etc/ssl/certs/server.crt

# Log files
sudo chmod 640 /var/log/apache2/*.log
sudo chmod 640 /var/log/nginx/*.log

# ===== PHP-FPM =====
# PHP session/temp files
sudo chown www-data:www-data /var/lib/php/sessions
sudo chmod 730 /var/lib/php/sessions

# .htaccess security (Apache)
# .htaccess permission itself
chmod 644 /var/www/html/.htaccess

# Block web access to .env files
# Add to .htaccess:
# <Files ".env">
#     Require all denied
# </Files>

# ===== Recommended permissions for WordPress =====
# File: 644
# Directory: 755
# wp-config.php: 440 or 400
# .htaccess: 644
find /var/www/wordpress -type f -exec chmod 644 {} \;
find /var/www/wordpress -type d -exec chmod 755 {} \;
chmod 440 /var/www/wordpress/wp-config.php
```

### 6.3 Database Permission Settings

```bash
# ===== MySQL / MariaDB =====
# Data directory
sudo chown -R mysql:mysql /var/lib/mysql/
sudo chmod 750 /var/lib/mysql/
sudo chmod 660 /var/lib/mysql/ib_logfile*

# Configuration files
sudo chmod 644 /etc/mysql/my.cnf
sudo chmod 640 /etc/mysql/conf.d/*.cnf

# Log files
sudo chmod 640 /var/log/mysql/error.log
sudo chown mysql:adm /var/log/mysql/error.log

# ===== PostgreSQL =====
# Data directory
sudo chown -R postgres:postgres /var/lib/postgresql/
sudo chmod 700 /var/lib/postgresql/*/main/

# Authentication settings
sudo chmod 640 /etc/postgresql/*/main/pg_hba.conf
sudo chown postgres:postgres /etc/postgresql/*/main/pg_hba.conf

# ===== SQLite =====
# Database file
chmod 660 /path/to/database.db
# Directory also needs write permission (for WAL mode)
chmod 770 /path/to/

# ===== Redis =====
sudo chown redis:redis /var/lib/redis/
sudo chmod 750 /var/lib/redis/
sudo chmod 640 /etc/redis/redis.conf
```

### 6.4 Application Permission Settings

```bash
# ===== Secret files =====
# .env files
chmod 600 .env
chmod 600 .env.production

# API key files
chmod 600 credentials.json
chmod 600 service-account.json
chmod 600 api_key.txt

# Encryption keys
chmod 600 encryption.key
chmod 600 master.key

# ===== Docker =====
# Docker socket
sudo chmod 660 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock

# Docker Compose files (when containing secrets)
chmod 600 docker-compose.override.yml

# ===== systemd services =====
# Unit files
sudo chmod 644 /etc/systemd/system/myapp.service

# Environment variable files (containing secrets)
sudo chmod 600 /etc/myapp/env
sudo chown root:root /etc/myapp/env

# ===== cron =====
# crontab files
chmod 600 /var/spool/cron/crontabs/*
# cron scripts
chmod 700 /etc/cron.d/myscript
chmod 755 /etc/cron.daily/backup.sh

# ===== Git hooks =====
chmod 755 .git/hooks/pre-commit
chmod 755 .git/hooks/post-merge

# ===== Python virtual environments =====
chmod 755 venv/bin/activate
chmod 755 venv/bin/python
```

### 6.5 Standard Permissions for Important System Files

```bash
# Authentication related
ls -la /etc/passwd         # 644 -rw-r--r-- (readable by everyone)
ls -la /etc/shadow         # 640 -rw-r----- (root and shadow group only)
ls -la /etc/group          # 644 -rw-r--r-- (readable by everyone)
ls -la /etc/gshadow        # 640 -rw-r----- (root and shadow group only)
ls -la /etc/sudoers        # 440 -r--r----- (root read-only)

# Network settings
ls -la /etc/hosts          # 644 -rw-r--r--
ls -la /etc/hostname       # 644 -rw-r--r--
ls -la /etc/resolv.conf    # 644 -rw-r--r--

# Service settings
ls -la /etc/ssh/sshd_config  # 600 -rw------- (root only)
ls -la /etc/crontab          # 644 -rw-r--r--

# Boot related
ls -la /boot/vmlinuz-*       # 600 -rw------- (Debian-based)
ls -la /boot/grub/grub.cfg   # 400 -r-------- (root read-only)

# Device files
ls -la /dev/null             # 666 crw-rw-rw-
ls -la /dev/zero             # 666 crw-rw-rw-
ls -la /dev/random           # 666 crw-rw-rw-
ls -la /dev/sda              # 660 brw-rw---- (root and disk group)
ls -la /dev/tty              # 666 crw-rw-rw-

# Permission audit: check critical files
check_critical_permissions() {
    echo "=== Critical File Permissions ==="
    for f in /etc/passwd /etc/shadow /etc/group /etc/sudoers \
             /etc/ssh/sshd_config; do
        if [ -f "$f" ]; then
            stat -c "%a %A %U:%G %n" "$f"
        fi
    done
}
```

---

## 7. Practical Techniques for Permission Management

### 7.1 Permission Operations Using find

```bash
# Find files with specific permissions
find /path -perm 777                  # exactly 777
find /path -perm -777                 # at least 777
find /path -perm /777                 # any bit matches

# Find world-writable files (security audit)
find / -perm -002 -type f 2>/dev/null
# -002 = all files with w for others

# Find world-writable directories (without Sticky Bit)
find / -perm -002 -not -perm -1000 -type d 2>/dev/null

# Find SUID/SGID files
find / -perm -4000 -type f 2>/dev/null  # SUID
find / -perm -2000 -type f 2>/dev/null  # SGID
find / -perm /6000 -type f 2>/dev/null  # SUID or SGID

# Find executable files
find /path -perm /111 -type f          # executable by anyone

# Fix files with improper permissions
# Normalize to file: 644, directory: 755
find /path -type f -not -perm 644 -exec chmod 644 {} \;
find /path -type d -not -perm 755 -exec chmod 755 {} \;

# Find files with no owner
find / -nouser 2>/dev/null
find / -nogroup 2>/dev/null
find / -nouser -o -nogroup 2>/dev/null

# Find files for a specific user
find / -user username 2>/dev/null
find / -uid 1000 2>/dev/null
find / -group groupname 2>/dev/null
find / -gid 1000 2>/dev/null

# Files with recently changed permissions
find / -cmin -60 2>/dev/null           # ctime changed within the last 60 minutes
# ctime = inode change time (includes permission changes)

# Writable SUID files (critical vulnerability)
find / -perm -4002 -type f 2>/dev/null
```

### 7.2 Permission Setting Scripts

```bash
#!/bin/bash
# fix-web-permissions.sh
# Script to fix permissions for web projects

WEB_ROOT="${1:?Usage: $0 <web-root-path>}"
WEB_USER="www-data"
WEB_GROUP="www-data"

# Check existence
if [ ! -d "$WEB_ROOT" ]; then
    echo "Error: $WEB_ROOT does not exist"
    exit 1
fi

echo "Fixing permissions for: $WEB_ROOT"

# Set ownership
echo "Setting ownership to ${WEB_USER}:${WEB_GROUP}..."
sudo chown -R "${WEB_USER}:${WEB_GROUP}" "$WEB_ROOT"

# Directory: 755
echo "Setting directory permissions to 755..."
find "$WEB_ROOT" -type d -exec chmod 755 {} \;

# File: 644
echo "Setting file permissions to 644..."
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

# Executables: 755
echo "Setting executable permissions..."
find "$WEB_ROOT" -name "*.sh" -exec chmod 755 {} \;
find "$WEB_ROOT" -name "*.py" -exec chmod 755 {} \;
find "$WEB_ROOT" -name "*.cgi" -exec chmod 755 {} \;

# Secret files: 600
echo "Securing sensitive files..."
find "$WEB_ROOT" -name ".env" -exec chmod 600 {} \;
find "$WEB_ROOT" -name "*.key" -exec chmod 600 {} \;
find "$WEB_ROOT" -name "*.pem" -exec chmod 600 {} \;
find "$WEB_ROOT" -name "wp-config.php" -exec chmod 440 {} \;

# Upload directory
if [ -d "$WEB_ROOT/uploads" ]; then
    echo "Setting upload directory permissions..."
    chmod 770 "$WEB_ROOT/uploads"
fi

# Log directory
if [ -d "$WEB_ROOT/logs" ]; then
    echo "Setting log directory permissions..."
    chmod 750 "$WEB_ROOT/logs"
    find "$WEB_ROOT/logs" -type f -exec chmod 640 {} \;
fi

echo "Done! Permissions fixed."
```

```bash
#!/bin/bash
# permission-audit.sh
# Permission check script for security audit

echo "============================================"
echo " Permission Security Audit Report"
echo " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Host: $(hostname)"
echo "============================================"
echo ""

# 1. World-writable files
echo "=== World-Writable Files ==="
world_writable=$(find / -perm -002 -type f -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null)
if [ -n "$world_writable" ]; then
    echo "$world_writable" | head -20
    echo "Total: $(echo "$world_writable" | wc -l) files"
else
    echo "None found. [OK]"
fi
echo ""

# 2. World-writable directories (without Sticky Bit)
echo "=== World-Writable Directories (without Sticky Bit) ==="
ww_dirs=$(find / -perm -002 -not -perm -1000 -type d \
    -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null)
if [ -n "$ww_dirs" ]; then
    echo "$ww_dirs" | head -20
    echo "Total: $(echo "$ww_dirs" | wc -l) directories"
    echo "[WARNING] These directories should have Sticky Bit set"
else
    echo "None found. [OK]"
fi
echo ""

# 3. SUID/SGID files
echo "=== SUID Files ==="
find / -perm -4000 -type f -not -path "/proc/*" -not -path "/sys/*" \
    -exec ls -la {} \; 2>/dev/null | head -20
echo ""

echo "=== SGID Files ==="
find / -perm -2000 -type f -not -path "/proc/*" -not -path "/sys/*" \
    -exec ls -la {} \; 2>/dev/null | head -20
echo ""

# 4. Orphaned files
echo "=== Orphaned Files (no user/group) ==="
orphans=$(find / -nouser -o -nogroup 2>/dev/null | head -20)
if [ -n "$orphans" ]; then
    echo "$orphans"
    echo "[WARNING] These files have no valid owner/group"
else
    echo "None found. [OK]"
fi
echo ""

# 5. Critical file permission check
echo "=== Critical File Permissions ==="
check_perm() {
    local file="$1"
    local expected="$2"
    if [ -f "$file" ]; then
        actual=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%OLp" "$file" 2>/dev/null)
        if [ "$actual" = "$expected" ]; then
            echo "[OK]   $file ($actual)"
        else
            echo "[WARN] $file ($actual, expected $expected)"
        fi
    fi
}

check_perm "/etc/passwd" "644"
check_perm "/etc/shadow" "640"
check_perm "/etc/group" "644"
check_perm "/etc/sudoers" "440"
check_perm "/etc/ssh/sshd_config" "600"
echo ""

# 6. SSH key permissions
echo "=== SSH Key Permissions ==="
if [ -d ~/.ssh ]; then
    ls -la ~/.ssh/ 2>/dev/null
    ssh_dir_perm=$(stat -c "%a" ~/.ssh 2>/dev/null || stat -f "%OLp" ~/.ssh 2>/dev/null)
    if [ "$ssh_dir_perm" != "700" ]; then
        echo "[WARN] ~/.ssh should be 700, is $ssh_dir_perm"
    fi
fi
echo ""

echo "============================================"
echo " Audit Complete"
echo "============================================"
```

### 7.3 Common Permission Setting Patterns

```bash
# ===== Pattern 1: Shared project directory =====
sudo mkdir -p /opt/project
sudo groupadd project-team
sudo usermod -aG project-team user1
sudo usermod -aG project-team user2

sudo chown root:project-team /opt/project
sudo chmod 2775 /opt/project
# SGID(2) + owner rwx(7) + group rwx(7) + others rx(5)
# New files are automatically assigned to project-team group

# ===== Pattern 2: Confidential document management =====
sudo mkdir -p /secure/documents
sudo chmod 700 /secure
sudo chmod 700 /secure/documents
sudo chown manager:management /secure/documents

# Grant access to specific members with ACL
setfacl -m u:assistant:rx /secure/documents
setfacl -d -m u:assistant:rx /secure/documents

# ===== Pattern 3: Log collection directory =====
sudo mkdir -p /var/log/app
sudo chown root:adm /var/log/app
sudo chmod 2750 /var/log/app
# Application writes, adm group reads

# logrotate configuration
sudo chmod 640 /var/log/app/*.log

# ===== Pattern 4: CI/CD deployment =====
sudo mkdir -p /var/www/app
sudo groupadd deployers
sudo chown root:deployers /var/www/app
sudo chmod 2775 /var/www/app

# Grant permissions to deploy user
sudo usermod -aG deployers deploy-bot
setfacl -R -m g:deployers:rwx /var/www/app
setfacl -R -d -m g:deployers:rwx /var/www/app

# Web server gets read only
setfacl -R -m u:www-data:rx /var/www/app
setfacl -R -d -m u:www-data:rx /var/www/app

# ===== Pattern 5: Backup directory =====
sudo mkdir -p /backup
sudo chown root:backup /backup
sudo chmod 770 /backup
# Backup scripts run as backup group

# Protect individual backups
sudo chmod 600 /backup/*.tar.gz

# ===== Pattern 6: Temporary working directory =====
sudo mkdir -p /tmp/shared-work
sudo chmod 1777 /tmp/shared-work
# Sticky Bit: cannot delete others' files, everyone can write
```

---

## 8. Linux Security Modules

### 8.1 SELinux Basics

```bash
# SELinux (Security-Enhanced Linux)
# Enabled by default on Red Hat-based systems (RHEL, CentOS, Fedora)
# Provides Mandatory Access Control (MAC) in addition to standard UNIX permissions

# Check SELinux status
getenforce
# Enforcing  : enforce policy (block violations)
# Permissive : log policy violations only (no blocking)
# Disabled   : SELinux disabled

sestatus
# SELinux status:                 enabled
# SELinuxfs mount:                /sys/fs/selinux
# SELinux root directory:         /etc/selinux
# Loaded policy name:             targeted
# Current mode:                   enforcing

# Temporarily change mode (reverts on reboot)
sudo setenforce 0       # change to Permissive
sudo setenforce 1       # change to Enforcing

# Permanent configuration change
sudo vi /etc/selinux/config
# SELINUX=enforcing   ← enforcing, permissive, disabled

# Display SELinux context
ls -Z file.txt
# -rw-r--r--. user group unconfined_u:object_r:user_home_t:s0 file.txt
#                         ↑user        ↑role     ↑type      ↑level

ps -eZ | grep httpd
# system_u:system_r:httpd_t:s0  1234 ?  00:00:01 httpd

# Change SELinux context
sudo chcon -t httpd_sys_content_t /var/www/html/index.html
sudo chcon -R -t httpd_sys_content_t /var/www/html/

# Restore to default context
sudo restorecon -v file.txt
sudo restorecon -Rv /var/www/html/

# Manage SELinux boolean values
getsebool -a                             # show all boolean values
getsebool httpd_can_network_connect      # specific boolean value

# Set boolean values
sudo setsebool httpd_can_network_connect on        # temporary
sudo setsebool -P httpd_can_network_connect on     # permanent

# Commonly used SELinux boolean values
sudo setsebool -P httpd_can_network_connect on     # allow Apache external connections
sudo setsebool -P httpd_enable_homedirs on         # allow home directories
sudo setsebool -P httpd_can_sendmail on            # allow sending mail

# Check SELinux violation logs
sudo ausearch -m AVC -ts recent
sudo sealert -a /var/log/audit/audit.log
sudo journalctl -t setroubleshoot

# Port management
sudo semanage port -l | grep http       # list HTTP-related ports
sudo semanage port -a -t http_port_t -p tcp 8080  # add custom port
```

### 8.2 AppArmor Basics

```bash
# AppArmor
# Enabled by default on Ubuntu, Debian, SUSE
# Profile-based mandatory access control

# Check AppArmor status
sudo aa-status
# apparmor module is loaded.
# 42 profiles are loaded.
# 25 profiles are in enforce mode.
# 17 profiles are in complain mode.

# Profile location
ls /etc/apparmor.d/

# Profile modes
# enforce  : enforce policy
# complain : log violations only (learning mode)
# disabled : profile disabled

# Change modes
sudo aa-enforce /etc/apparmor.d/usr.sbin.apache2    # enforce mode
sudo aa-complain /etc/apparmor.d/usr.sbin.apache2   # learning mode
sudo aa-disable /etc/apparmor.d/usr.sbin.apache2    # disable

# Load profiles
sudo apparmor_parser -r /etc/apparmor.d/usr.sbin.apache2  # reload
sudo apparmor_parser -R /etc/apparmor.d/usr.sbin.apache2  # remove

# Check logs (detect violations)
sudo journalctl -k | grep apparmor
sudo dmesg | grep apparmor
# Search for DENIED
sudo journalctl -k | grep "apparmor.*DENIED"

# Generate profile
sudo aa-genprof /usr/bin/myapp
# → operate the application to let it learn
# → profile is auto-generated

# Simple profile example (/etc/apparmor.d/usr.local.bin.myapp)
# /usr/local/bin/myapp {
#   /usr/local/bin/myapp mr,         # read+execute itself
#   /etc/myapp/** r,                 # read config files
#   /var/log/myapp/** w,             # write logs
#   /tmp/myapp-* rw,                 # read/write temp files
#   /usr/lib/** rm,                  # read+execute libraries
#   network tcp,                      # allow TCP communication
# }
```

### 8.3 Linux Capabilities

```bash
# Linux Capabilities: a mechanism that subdivides root privileges
# Allows granting specific privileges to processes/files

# Main Capabilities
# CAP_NET_BIND_SERVICE : bind to ports below 1024
# CAP_NET_RAW          : use RAW sockets (ping, etc.)
# CAP_SYS_ADMIN        : many administrative operations
# CAP_DAC_OVERRIDE     : bypass file access control
# CAP_CHOWN            : change file owner
# CAP_KILL             : send signals to other users' processes
# CAP_SETUID/SETGID    : change UID/GID

# Check file Capabilities
getcap /usr/bin/ping
# /usr/bin/ping cap_net_raw=ep

# Search all files for Capabilities
getcap -r / 2>/dev/null

# Set Capability (requires root)
sudo setcap cap_net_bind_service=+ep /usr/bin/myapp
# → myapp can bind to port 80 without root

# Remove Capability
sudo setcap -r /usr/bin/myapp

# Check process Capabilities
cat /proc/$$/status | grep -i cap
# CapInh: 0000000000000000  (inheritable)
# CapPrm: 0000000000000000  (permitted)
# CapEff: 0000000000000000  (effective)
# CapBnd: 000001ffffffffff  (bounding set)
# CapAmb: 0000000000000000  (ambient)

# Convert numbers to readable form
capsh --decode=000001ffffffffff

# Practical example: use Capability instead of SUID
# ping command (traditionally SUID)
sudo chmod u-s /usr/bin/ping
sudo setcap cap_net_raw=ep /usr/bin/ping
# → ping works without SUID

# Practical example: run Node.js app on port 80 without root
sudo setcap cap_net_bind_service=+ep /usr/bin/node
# or
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

---

## 9. Troubleshooting

### 9.1 Common Permission Errors

```bash
# ===== Error 1: Permission denied =====
$ cat /etc/shadow
cat: /etc/shadow: Permission denied

# Cause: no read permission
# Fix:
ls -la /etc/shadow     # check permissions
sudo cat /etc/shadow   # run with root privileges

# ===== Error 2: Operation not permitted =====
$ chown user file.txt
chown: changing ownership of 'file.txt': Operation not permitted

# Cause: chown requires root privileges
# Fix:
sudo chown user file.txt

# ===== Error 3: SSH Permission denied =====
# "Permissions 0644 for '~/.ssh/id_rsa' are too open."
# Cause: SSH key permissions are too permissive
# Fix:
chmod 600 ~/.ssh/id_rsa
chmod 700 ~/.ssh

# ===== Error 4: bash: ./script.sh: Permission denied =====
# Cause: no execute permission
# Fix:
chmod +x script.sh
# or
bash script.sh         # call bash explicitly

# ===== Error 5: mkdir: cannot create directory: Permission denied =====
# Cause: no write permission on parent directory
# Fix:
ls -la /parent/dir/    # check parent directory permissions
sudo mkdir /parent/dir/newdir

# ===== Error 6: rm: cannot remove: Operation not permitted =====
# Cause 1: file has immutable flag
lsattr file.txt        # check flags
# ----i--------e-- file.txt  ← i=immutable
sudo chattr -i file.txt  # remove immutable flag
rm file.txt

# Cause 2: other person's file in Sticky Bit directory
ls -ld /tmp            # check Sticky Bit
# drwxrwxrwt ...       ← t is present

# ===== Error 7: cp: cannot create regular file: Permission denied =====
# Cause: no write permission on destination directory
ls -la /destination/   # check destination permissions
# Fix:
sudo cp file.txt /destination/
# or
chmod u+w /destination/
```

### 9.2 File Attributes (chattr / lsattr)

```bash
# chattr: set extended file attributes (a separate control layer from permissions)
# lsattr: display extended file attributes

# Main attributes
# i (immutable) : cannot be changed, deleted, renamed, or linked (even by root!)
# a (append)    : append only (suitable for log files)
# e (extent)    : uses ext4 extents (usually default)
# A (noatime)   : do not update access time
# S (sync)      : write to disk immediately
# d (nodump)    : excluded from dump backups
# c (compress)  : auto-compress (requires supported FS)

# Display attributes
lsattr file.txt
# ----i--------e-- file.txt

lsattr -d dir/        # attributes of a directory
lsattr -R dir/        # display recursively

# Set immutable attribute (strongest protection)
sudo chattr +i important.conf
# → cannot be changed or deleted, even by root
# → requires chattr -i to unlock

rm important.conf
# rm: cannot remove 'important.conf': Operation not permitted

sudo rm important.conf
# rm: cannot remove 'important.conf': Operation not permitted
# → even root cannot delete!

# Remove immutable
sudo chattr -i important.conf
rm important.conf     # OK

# append-only attribute (for log files)
sudo chattr +a /var/log/secure.log
echo "new entry" >> /var/log/secure.log    # OK (append)
echo "overwrite" > /var/log/secure.log     # Error (no overwrite)
rm /var/log/secure.log                      # Error (no delete)

# Practical example: protect important config files
sudo chattr +i /etc/resolv.conf    # protect DNS settings
sudo chattr +i /etc/passwd         # protect password file
sudo chattr +i /etc/shadow         # protect shadow file
# Note: user management tools will stop working, so only use for temporary protection

# Practical example: protect boot files
sudo chattr +i /boot/vmlinuz-*
sudo chattr +i /boot/initrd.img-*

# Find files with immutable flag
lsattr -R / 2>/dev/null | grep -- "----i"
```

### 9.3 Debugging Techniques

```bash
# ===== namei: check permissions along entire path =====
# When you cannot access a file, find which part of the path lacks permissions
namei -l /var/www/html/index.html
# f: /var/www/html/index.html
# dr-xr-xr-x root root /
# drwxr-xr-x root root var
# drwxr-xr-x root root www
# drwxr-xr-x root root html
# -rw-r--r-- root root index.html

# Check the x bit on each directory
# A directory without x will block access there

# ===== strace: trace permission errors at system call level =====
strace -f -e trace=open,openat,access cat /etc/shadow 2>&1
# openat(AT_FDCWD, "/etc/shadow", O_RDONLY) = -1 EACCES (Permission denied)

# ===== sudo -l: check available sudo permissions =====
sudo -l
# User user may run the following commands on host:
#     (ALL : ALL) ALL
#     (root) /usr/bin/systemctl restart apache2

# ===== getfacl: full permission check including ACL =====
getfacl /path/to/file

# ===== /proc/self/status: permission info for current process =====
cat /proc/self/status | grep -E "Uid|Gid|Groups|Cap"

# ===== loginctl: check login sessions =====
loginctl show-user $USER

# ===== Check permission change history =====
# When auditd is enabled
sudo ausearch -f /path/to/file -ts recent
# Records access attempts and permission changes to file

# Add audit rules
sudo auditctl -w /etc/passwd -p wa -k passwd_changes
# -w: file to monitor
# -p: operations to monitor (w=write, a=attribute change)
# -k: key for log search

# ===== inotifywait: real-time file monitoring =====
# Monitor permission changes in real time
inotifywait -m -e attrib /path/to/file
# /path/to/file ATTRIB  ← permission or attribute changed

# ===== Testing from a specific user's perspective =====
# Test access as a specific user
sudo -u www-data cat /var/www/html/config.php
sudo -u postgres ls /var/lib/postgresql/

# ===== Check with access command (test) =====
# Test if current user can access
test -r file.txt && echo "Readable" || echo "Not readable"
test -w file.txt && echo "Writable" || echo "Not writable"
test -x file.txt && echo "Executable" || echo "Not executable"

# Use in scripts
if [ ! -r "$config_file" ]; then
    echo "Error: Cannot read $config_file" >&2
    echo "Current permissions: $(ls -la "$config_file")" >&2
    echo "Run: sudo chmod +r $config_file" >&2
    exit 1
fi
```

---

## 10. macOS-Specific Permissions

### 10.1 macOS Permission Characteristics

```bash
# macOS uses a BSD-based permission system + proprietary extensions
# POSIX permissions + ACL + SIP + TCC + Sandbox

# Basic permission operations are the same as Linux
chmod 755 file.txt
chown user:group file.txt
# However, stat command format is BSD style

# macOS stat (BSD version)
stat -f "%Sp %Su %Sg %z %N" file.txt
# -rw-r--r-- user staff 4096 file.txt

# Numeric display
stat -f "%OLp %N" file.txt
# 644 file.txt

# Default group on macOS is "staff"
id
# uid=501(user) gid=20(staff) groups=20(staff),80(admin),...

# macOS ACL
# macOS uses its own ACL format
ls -le file.txt              # display ACL (-e option)
# -rw-r--r--+ 1 user staff 4096 Jan 1 file.txt
#  0: user:alice allow read,write
#  1: group:devteam allow read

# Set macOS ACL
chmod +a "user:alice allow read,write" file.txt
chmod +a "group:devteam allow read" file.txt
chmod +a "user:bob deny write" file.txt       # deny rule

# Remove macOS ACL
chmod -a "user:alice allow read,write" file.txt
chmod -a# 0 file.txt          # remove ACL at index 0
chmod -N file.txt              # remove all ACLs

# Specify ACL order
chmod +a# 0 "user:alice allow read,write" file.txt  # insert at beginning
```

### 10.2 SIP (System Integrity Protection)

```bash
# SIP: macOS system file protection feature
# Even root cannot modify protected files/directories

# Check SIP status
csrutil status
# System Integrity Protection status: enabled.

# Directories protected by SIP
# /System
# /usr (except /usr/local)
# /bin
# /sbin
# /Applications (pre-installed apps)

# Error example under SIP protection
sudo rm /usr/bin/python3
# rm: /usr/bin/python3: Operation not permitted
# → even root cannot delete due to SIP

# Disabling SIP (not recommended, only for development)
# Boot in Recovery Mode → Terminal → csrutil disable
# Takes effect after restart

# /usr/local is not subject to SIP
# Homebrew installs here
ls -la /usr/local/bin/
```

### 10.3 xattr (Extended Attributes)

```bash
# macOS extended attributes
# A mechanism to attach metadata to files

# Display extended attributes
xattr file.txt
xattr -l file.txt                    # also show values

# Commonly seen extended attributes
# com.apple.quarantine        : quarantine flag for downloaded files
# com.apple.metadata:kMDItemWhereFroms : download source URL
# com.apple.FinderInfo        : Finder display info
# com.apple.ResourceFork      : resource fork

# Check quarantine flag
xattr -p com.apple.quarantine downloaded_file
# 0083;5f8b1234;Chrome;...

# Remove quarantine flag (bypass Gatekeeper warning)
xattr -d com.apple.quarantine downloaded_file
# Remove from entire directory
xattr -dr com.apple.quarantine ~/Downloads/app.app

# Remove all extended attributes
xattr -c file.txt

# Set extended attributes
xattr -w com.example.note "important file" file.txt

# Remove extended attributes recursively
xattr -cr dir/

# @ mark: indicates extended attributes in ls
ls -la
# -rw-r--r--@ 1 user staff 4096 Jan 1 downloaded.zip
#            ^ @ means extended attributes are present
```

---

## Practical Exercises

### Exercise 1: [Basic] — Permission Operations

```bash
# Add execute permission to a script
echo '#!/bin/bash' > /tmp/test.sh
echo 'echo "Hello from test.sh!"' >> /tmp/test.sh
echo 'echo "Running as: $(whoami)"' >> /tmp/test.sh
echo 'echo "PID: $$"' >> /tmp/test.sh

# Check permissions
ls -la /tmp/test.sh
# -rw-r--r-- 1 user group ... test.sh  (no execute)

# Try to execute (should fail)
/tmp/test.sh
# bash: /tmp/test.sh: Permission denied

# Add execute permission
chmod +x /tmp/test.sh
ls -la /tmp/test.sh
# -rwxr-xr-x 1 user group ... test.sh  (execute added)

# Execute
/tmp/test.sh
# Hello from test.sh!
# Running as: user
# PID: 12345

# Check permissions as numeric
stat -c "%a %n" /tmp/test.sh 2>/dev/null || stat -f "%OLp %N" /tmp/test.sh
# 755 /tmp/test.sh

# Cleanup
rm /tmp/test.sh
```

### Exercise 2: [Basic] — Understanding umask

```bash
# Check current umask
echo "Current umask: $(umask)"
echo "Symbolic: $(umask -S)"

# Create files with umask 022
umask 022
touch /tmp/umask_022.txt
mkdir /tmp/umask_022_dir
echo "umask 022:"
stat -c "  File: %a %n" /tmp/umask_022.txt 2>/dev/null
stat -c "  Dir:  %a %n" /tmp/umask_022_dir 2>/dev/null
# File: 644
# Dir:  755

# Create files with umask 077
umask 077
touch /tmp/umask_077.txt
mkdir /tmp/umask_077_dir
echo "umask 077:"
stat -c "  File: %a %n" /tmp/umask_077.txt 2>/dev/null
stat -c "  Dir:  %a %n" /tmp/umask_077_dir 2>/dev/null
# File: 600
# Dir:  700

# Create files with umask 002
umask 002
touch /tmp/umask_002.txt
mkdir /tmp/umask_002_dir
echo "umask 002:"
stat -c "  File: %a %n" /tmp/umask_002.txt 2>/dev/null
stat -c "  Dir:  %a %n" /tmp/umask_002_dir 2>/dev/null
# File: 664
# Dir:  775

# Restore umask
umask 022

# Cleanup
rm -f /tmp/umask_*.txt
rmdir /tmp/umask_*_dir
```

### Exercise 3: [Intermediate] — Building a Team Shared Directory

```bash
# Create a team shared directory with appropriate permissions
# This exercise requires root privileges

# 1. Create group
sudo groupadd exercise-team 2>/dev/null

# 2. Create test users (for exercise)
sudo useradd -m -G exercise-team member1 2>/dev/null
sudo useradd -m -G exercise-team member2 2>/dev/null

# 3. Create shared directory
sudo mkdir -p /tmp/team-share

# 4. Set owner and group
sudo chown root:exercise-team /tmp/team-share

# 5. Set SGID + Sticky Bit
sudo chmod 3770 /tmp/team-share
# 3 = SGID(2) + Sticky(1)
# 770 = rwx rwx ---

# Verify
ls -ld /tmp/team-share
# drwxrws--T 2 root exercise-team 4096 ... team-share
# s = SGID (group is inherited for new files)
# T = Sticky (cannot delete other members' files)
# Uppercase T because others has no x

# 6. Test: member1 creates a file
sudo -u member1 touch /tmp/team-share/member1_file.txt
ls -la /tmp/team-share/member1_file.txt
# -rw-r--r-- 1 member1 exercise-team ... member1_file.txt
# → group is automatically set to exercise-team (SGID effect)

# 7. Test: member2 tries to delete member1's file (should fail)
sudo -u member2 rm /tmp/team-share/member1_file.txt 2>&1
# rm: cannot remove ...: Operation not permitted (Sticky Bit effect)

# 8. Test: member2 creates and deletes their own file (should succeed)
sudo -u member2 touch /tmp/team-share/member2_file.txt
sudo -u member2 rm /tmp/team-share/member2_file.txt

# Cleanup
sudo rm -rf /tmp/team-share
sudo userdel -r member1 2>/dev/null
sudo userdel -r member2 2>/dev/null
sudo groupdel exercise-team 2>/dev/null
```

### Exercise 4: [Intermediate] — Setting and Verifying ACL

```bash
# Implement complex access control using ACL

# 1. Create test environment
mkdir -p /tmp/acl-exercise/docs
mkdir -p /tmp/acl-exercise/code

echo "Secret document" > /tmp/acl-exercise/docs/secret.txt
echo "Public code" > /tmp/acl-exercise/code/main.py

# 2. Set base permissions
chmod 700 /tmp/acl-exercise/docs/
chmod 755 /tmp/acl-exercise/code/

# 3. Set ACL (experiment with your own user)
# Grant read access to docs for a specific user
# (run with an existing username)
setfacl -m u:$(whoami):rx /tmp/acl-exercise/docs/
setfacl -m u:$(whoami):r /tmp/acl-exercise/docs/secret.txt

# 4. Verify ACL
echo "=== Directory ACL ==="
getfacl /tmp/acl-exercise/docs/
echo ""
echo "=== File ACL ==="
getfacl /tmp/acl-exercise/docs/secret.txt

# 5. Set default ACL (automatically applied to new files)
setfacl -d -m u:$(whoami):r /tmp/acl-exercise/docs/

# 6. Verify default ACL
touch /tmp/acl-exercise/docs/new_file.txt
echo "=== New file ACL (should inherit default) ==="
getfacl /tmp/acl-exercise/docs/new_file.txt

# 7. Verify + mark in ls
ls -la /tmp/acl-exercise/docs/
# + mark should be displayed

# 8. Backup and restore ACL
getfacl -R /tmp/acl-exercise/ > /tmp/acl_backup.txt
echo "=== ACL Backup ==="
cat /tmp/acl_backup.txt

# 9. Remove ACL
setfacl -b /tmp/acl-exercise/docs/secret.txt
echo "=== After ACL removal ==="
getfacl /tmp/acl-exercise/docs/secret.txt

# 10. Restore from backup
setfacl --restore=/tmp/acl_backup.txt
echo "=== After ACL restore ==="
getfacl /tmp/acl-exercise/docs/secret.txt

# Cleanup
rm -rf /tmp/acl-exercise /tmp/acl_backup.txt
```

### Exercise 5: [Advanced] — Security Audit Script

```bash
#!/bin/bash
# security-check.sh
# Audit permissions in your home directory

HOME_DIR="${HOME}"
ISSUES=0

echo "============================================"
echo " Home Directory Security Check"
echo " User: $(whoami)"
echo " Home: ${HOME_DIR}"
echo " Date: $(date)"
echo "============================================"
echo ""

# 1. Home directory permissions
echo "=== 1. Home Directory ==="
home_perm=$(stat -c "%a" "${HOME_DIR}" 2>/dev/null || stat -f "%OLp" "${HOME_DIR}" 2>/dev/null)
if [ "$home_perm" -gt 755 ]; then
    echo "[WARN] Home directory is too permissive: $home_perm (should be 755 or less)"
    ISSUES=$((ISSUES + 1))
else
    echo "[OK]   Home directory: $home_perm"
fi
echo ""

# 2. SSH directory
echo "=== 2. SSH Configuration ==="
if [ -d "${HOME_DIR}/.ssh" ]; then
    ssh_perm=$(stat -c "%a" "${HOME_DIR}/.ssh" 2>/dev/null || stat -f "%OLp" "${HOME_DIR}/.ssh" 2>/dev/null)
    if [ "$ssh_perm" != "700" ]; then
        echo "[WARN] .ssh directory: $ssh_perm (should be 700)"
        ISSUES=$((ISSUES + 1))
    else
        echo "[OK]   .ssh directory: $ssh_perm"
    fi

    # Check private keys
    for key in "${HOME_DIR}"/.ssh/id_*; do
        if [ -f "$key" ] && [[ ! "$key" == *.pub ]]; then
            key_perm=$(stat -c "%a" "$key" 2>/dev/null || stat -f "%OLp" "$key" 2>/dev/null)
            if [ "$key_perm" != "600" ] && [ "$key_perm" != "400" ]; then
                echo "[WARN] Private key $key: $key_perm (should be 600 or 400)"
                ISSUES=$((ISSUES + 1))
            else
                echo "[OK]   Private key $key: $key_perm"
            fi
        fi
    done
else
    echo "[INFO] No .ssh directory found"
fi
echo ""

# 3. Sensitive files
echo "=== 3. Sensitive Files ==="
for pattern in ".env" ".env.*" "*.pem" "*.key" "credentials*" "secret*"; do
    while IFS= read -r -d '' sensitive; do
        s_perm=$(stat -c "%a" "$sensitive" 2>/dev/null || stat -f "%OLp" "$sensitive" 2>/dev/null)
        if [ "$s_perm" -gt 600 ]; then
            echo "[WARN] $sensitive: $s_perm (should be 600 or less)"
            ISSUES=$((ISSUES + 1))
        else
            echo "[OK]   $sensitive: $s_perm"
        fi
    done < <(find "${HOME_DIR}" -maxdepth 3 -name "$pattern" -type f -print0 2>/dev/null)
done
echo ""

# 4. World-writable files
echo "=== 4. World-Writable Files ==="
ww_files=$(find "${HOME_DIR}" -perm -002 -type f 2>/dev/null | head -10)
if [ -n "$ww_files" ]; then
    echo "$ww_files"
    ww_count=$(find "${HOME_DIR}" -perm -002 -type f 2>/dev/null | wc -l)
    echo "[WARN] Found $ww_count world-writable files"
    ISSUES=$((ISSUES + $ww_count))
else
    echo "[OK]   No world-writable files found"
fi
echo ""

# 5. Hidden executable files
echo "=== 5. Hidden Executable Files ==="
hidden_exec=$(find "${HOME_DIR}" -maxdepth 2 -name ".*" -perm /111 -type f 2>/dev/null | head -10)
if [ -n "$hidden_exec" ]; then
    echo "$hidden_exec"
    echo "[INFO] Review these hidden executable files"
else
    echo "[OK]   No suspicious hidden executables"
fi
echo ""

# Summary
echo "============================================"
if [ $ISSUES -eq 0 ]; then
    echo " Result: All checks passed!"
else
    echo " Result: $ISSUES issue(s) found"
    echo " Run the suggested fixes to resolve them."
fi
echo "============================================"
```

### Exercise 6: [Advanced] — Monitoring Permission Changes

```bash
# Real-time permission monitoring using inotifywait
# Install: sudo apt install inotify-tools

#!/bin/bash
# watch-permissions.sh
# Monitor permission changes in a specified directory

WATCH_DIR="${1:-.}"
LOG_FILE="/tmp/permission_changes.log"

echo "Watching permission changes in: $WATCH_DIR"
echo "Log file: $LOG_FILE"
echo "Press Ctrl+C to stop"

# Monitor attrib (attribute change) events with inotifywait
inotifywait -m -r -e attrib --format '%T %w%f %e' \
    --timefmt '%Y-%m-%d %H:%M:%S' \
    "$WATCH_DIR" 2>/dev/null | while read -r line; do

    timestamp=$(echo "$line" | awk '{print $1, $2}')
    filepath=$(echo "$line" | awk '{print $3}')
    event=$(echo "$line" | awk '{print $4}')

    if [ -e "$filepath" ]; then
        perms=$(stat -c "%a %A %U:%G" "$filepath" 2>/dev/null)
        echo "[$timestamp] $filepath -> $perms ($event)" | tee -a "$LOG_FILE"
    fi
done

# Test in another terminal:
# chmod 777 /path/to/watched/file
# → appears in real time in the monitoring screen

# Monitoring with auditd (more production-grade)
# sudo auditctl -w /etc/passwd -p wa -k passwd_watch
# sudo ausearch -k passwd_watch
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Category | Operation | Command |
|---------|------|---------|
| Display permissions | List | `ls -la`, `stat` |
| Change permissions | Numeric | `chmod 755 file` |
| Change permissions | Symbolic | `chmod u+x file` |
| Change permissions | Recursive | `chmod -R 755 dir/` |
| Change permissions | Separate files/dirs | `find -type f/d -exec chmod` |
| Change owner | Owner+group | `chown user:group file` |
| Change group | Group only | `chgrp group file` |
| Default permissions | Set umask | `umask 022` |
| Special bits | SUID | `chmod u+s file` / `chmod 4755` |
| Special bits | SGID | `chmod g+s dir/` / `chmod 2755` |
| Special bits | Sticky | `chmod +t dir/` / `chmod 1777` |
| Display ACL | Check ACL | `getfacl file` |
| Set ACL | User ACL | `setfacl -m u:user:rw file` |
| Set ACL | Group ACL | `setfacl -m g:group:rx file` |
| Set ACL | Default ACL | `setfacl -d -m u:user:rw dir/` |
| Remove ACL | Remove all | `setfacl -b file` |
| File attributes | Set immutable | `chattr +i file` |
| File attributes | Append only | `chattr +a file` |
| File attributes | Check attributes | `lsattr file` |
| Capability | Check | `getcap file` |
| Capability | Set | `setcap cap_xxx=+ep file` |
| Security audit | Find SUID | `find / -perm -4000` |
| Security audit | Find world-writable | `find / -perm -002` |
| Security audit | Orphaned files | `find / -nouser -o -nogroup` |
| SELinux | Check status | `getenforce`, `sestatus` |
| AppArmor | Check status | `aa-status` |

### Permission Setting Quick Reference

```
Purpose                     Permission     Command
─────────────────────────────────────────────────
Public web file             644            chmod 644 index.html
Public directory            755            chmod 755 public/
Executable script           755            chmod 755 script.sh
SSH private key             600 or 400     chmod 600 ~/.ssh/id_rsa
.ssh directory              700            chmod 700 ~/.ssh
Secret config file          600            chmod 600 .env
Shared directory            2775           chmod 2775 /shared/
Temporary directory         1777           chmod 1777 /tmp/
Log file                    640            chmod 640 app.log
SSL private key             600            chmod 600 server.key
SSL certificate             644            chmod 644 server.crt
crontab                     600            chmod 600 crontab
sudoers                     440            chmod 440 /etc/sudoers
```

---

## Next Guides to Read

---

## References
1. Kerrisk, M. "The Linux Programming Interface." Ch.15: File Attributes, 2010.
2. Shotts, W. "The Linux Command Line." Ch.9: Permissions, 5th ed., 2019.
3. Nemeth, E. et al. "UNIX and Linux System Administration Handbook." Ch.5: Access Control, 5th ed., 2017.
4. Red Hat. "SELinux User's and Administrator's Guide." Red Hat Enterprise Linux 8 Documentation.
5. Ubuntu. "AppArmor." Ubuntu Community Help Wiki.
6. POSIX.1-2017. "IEEE Std 1003.1: File Access Permissions."
7. Grüenbacher, A. "POSIX Access Control Lists on Linux." USENIX, 2003.
